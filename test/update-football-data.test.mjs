import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { players } from '../src/data/players.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.join(projectRoot, 'src', 'data', 'generated', 'snapshot.json')
const updaterPath = path.join(projectRoot, 'scripts', 'update-football-data.mjs')
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
const snapshotPlayerById = new Map([
  ...players,
  ...(snapshot.providerPlayers || []),
].map((player) => [String(player.id), player]))
const apiFootballLeagueIds = new Map([
  ['la liga', 140],
  ['champions league', 2],
])

function responseWrapper(response, paging = { current: 1, total: 1 }) {
  return { get: '', parameters: {}, errors: [], results: response.length, paging, response }
}

function leagueIdFor(entry) {
  return apiFootballLeagueIds.get(String(entry.competition).toLowerCase())
    || entry.providerLeagueId
}

function opponentId(name) {
  return 600 + [...name].reduce((total, character) => total + character.codePointAt(0), 0)
}

function normalizedSnapshotPlayerReference(value) {
  return String(value ?? '').trim().replace(/^api-/i, '')
}

function providerPlayerId(snapshotId) {
  const normalizedId = normalizedSnapshotPlayerReference(snapshotId)
  if (!normalizedId) return null
  if (/^\d+$/.test(normalizedId) && Number(normalizedId) > 0) {
    return 10_000 + Number(normalizedId)
  }
  return 20_000 + [...normalizedId].reduce(
    (total, character) => (Math.imul(total, 31) + character.codePointAt(0)) >>> 0,
    7,
  )
}

test('provider fixture mocks preserve player identities without inventing missing ids', () => {
  assert.equal(providerPlayerId('api-9877550'), providerPlayerId(9877550))
  assert.equal(providerPlayerId(null), null)
  assert.equal(providerPlayerId(undefined), null)
})

function apiTeam(name, code) {
  return code === 'BAR'
    ? { id: 529, name: 'Barcelona' }
    : { id: opponentId(name), name }
}

function apiEvent(goal, entry) {
  const [elapsed, extra] = String(goal.minute).split('+').map(Number)
  let eventTeam = goal.teamCode === entry.homeCode
    ? apiTeam(entry.home, entry.homeCode)
    : apiTeam(entry.away, entry.awayCode)
  if (goal.type === 'own-goal') {
    eventTeam = goal.teamCode === entry.homeCode
      ? apiTeam(entry.away, entry.awayCode)
      : apiTeam(entry.home, entry.homeCode)
  }
  const scorerProviderId = providerPlayerId(goal.scorerId)
  const assistProviderId = providerPlayerId(goal.assistId)
  const details = {
    penalty: 'Penalty',
    'own-goal': 'Own Goal',
    'free-kick': 'Free Kick',
    goal: 'Normal Goal',
  }
  return {
    time: { elapsed, extra: extra || null },
    team: eventTeam,
    player: { id: scorerProviderId, name: goal.scorer },
    assist: goal.assist ? { id: assistProviderId, name: goal.assist } : { id: null, name: null },
    type: 'Goal',
    detail: details[goal.type] || 'Normal Goal',
  }
}

function apiFixture(entry, index, includeEvents = false) {
  const finished = entry.homeScore !== undefined
  // The first provider result intentionally corrects a manual seed date. A first API
  // migration must trust the verified provider instead of becoming permanently blocked.
  const kickoff = index === 0 && finished
    ? '2026-09-17T19:00:00Z'
    : entry.kickoff || `${entry.date}T19:00:00Z`
  return {
    fixture: {
      id: 50_000 + index,
      date: kickoff,
      timestamp: Math.floor(Date.parse(kickoff) / 1000),
      venue: { name: entry.venue },
      status: { short: entry.status },
    },
    league: {
      id: leagueIdFor(entry),
      name: entry.competition,
      round: entry.round,
    },
    teams: {
      home: apiTeam(entry.home, entry.homeCode),
      away: apiTeam(entry.away, entry.awayCode),
    },
    goals: {
      home: finished ? entry.homeScore : null,
      away: finished ? entry.awayScore : null,
    },
    ...(includeEvents && finished
      ? { events: entry.goals.map((goal) => apiEvent(goal, entry)) }
      : {}),
  }
}

const allEntries = [...snapshot.results, ...snapshot.fixtures]
const knockoutFixtures = Array.from({ length: 8 }, (_, index) => ({
  fixture: {
    id: 60_000 + index,
    date: `2027-02-${String(index + 1).padStart(2, '0')}T20:00:00Z`,
    timestamp: 1_801_512_000 + (index * 86_400),
    venue: { name: `Knockout venue ${index + 1}` },
    status: { short: 'FT' },
  },
  league: { id: 2, name: 'Champions League', round: index < 2 ? 'Round of 16' : 'Quarter-finals' },
  teams: {
    home: { id: 529, name: 'Barcelona' },
    away: { id: 95_000 + index, name: `Knockout opponent ${index + 1}` },
  },
  goals: { home: 0, away: 0 },
  events: [],
}))
const bulkFixtures = [
  ...allEntries.map((entry, index) => apiFixture(entry, index)),
  ...knockoutFixtures.map((fixture) => ({ ...fixture, events: undefined })),
]
const detailedFixtures = [
  ...allEntries.map((entry, index) => apiFixture(entry, index, true)),
  ...knockoutFixtures,
]

function minimumRecordedContributions(playerId) {
  const totals = { goals: 0, assists: 0 }
  const normalizedPlayerId = normalizedSnapshotPlayerReference(playerId)
  for (const result of snapshot.results) {
    if (!apiFootballLeagueIds.has(String(result.competition).toLowerCase())) continue
    for (const goal of result.goals || []) {
      if (goal.teamCode !== 'BAR' || goal.type === 'own-goal') continue
      if (normalizedSnapshotPlayerReference(goal.scorerId) === normalizedPlayerId) totals.goals += 1
      if (normalizedSnapshotPlayerReference(goal.assistId) === normalizedPlayerId) totals.assists += 1
    }
  }
  return totals
}

function playerRows() {
  return snapshot.playerStats.map((stat) => {
    const player = snapshotPlayerById.get(String(stat.playerId)) || {
      name: `Player ${stat.playerId}`,
      number: '—',
      position: 'Player',
    }
    const contributions = minimumRecordedContributions(stat.playerId)
    return {
      player: {
        id: providerPlayerId(stat.playerId),
        name: player.name,
        firstname: player.name.split(' ')[0],
        lastname: player.name.split(' ').slice(1).join(' '),
        photo: `https://example.test/player-${stat.playerId}.png`,
      },
      statistics: [{
        team: { id: 529, name: 'Barcelona' },
        league: { id: 140, name: 'La Liga' },
        games: {
          appearences: stat.appearances,
          lineups: stat.starts,
          minutes: stat.minutes,
          number: player.number,
          position: player.position,
        },
        goals: {
          total: Math.max(stat.goals, contributions.goals),
          assists: Math.max(stat.assists, contributions.assists),
        },
      }],
    }
  })
}

function standingsResponse(providerLeagueId) {
  const competitionName = [...apiFootballLeagueIds.entries()]
    .find(([, id]) => id === providerLeagueId)?.[0]
  const standing = snapshot.standings.find(
    (entry) => String(entry.id).replaceAll('-', ' ') === competitionName,
  )
  const rows = Array.from({ length: standing.totalTeams }, (_, index) => {
    const rank = index + 1
    return {
      rank,
      team: { id: 70_000 + rank, name: `Team ${rank}` },
      points: Math.max(0, standing.points - rank),
      goalsDiff: 0,
      form: '',
      all: { played: standing.played, win: 0, draw: standing.played, lose: 0, goals: { for: 0, against: 0 } },
    }
  })
  rows[standing.position - 1] = {
    rank: standing.position,
    team: { id: 529, name: 'Barcelona' },
    points: standing.points,
    goalsDiff: standing.goalDifference,
    form: standing.form.join(''),
    all: {
      played: standing.played,
      win: standing.wins,
      draw: standing.draws,
      lose: standing.losses,
      goals: { for: standing.goalsFor, against: standing.goalsAgainst },
    },
  }
  if (standing.position === 1) {
    rows[1].points = Math.max(0, standing.points - 3)
    rows[1].team.name = 'Real Madrid'
  }
  return [{
    league: {
      id: standing.providerLeagueId,
      name: standing.competition,
      season: 2026,
      standings: [rows],
    },
  }]
}

function leaguesResponse() {
  return snapshot.standings.map((standing) => ({
    league: {
      id: apiFootballLeagueIds.get(String(standing.id).replaceAll('-', ' ')),
      name: standing.competition,
      type: 'League',
    },
    country: { name: 'Spain' },
    seasons: [{
      year: 2026,
      current: true,
      coverage: {
        standings: true,
        players: true,
        fixtures: { events: true, statistics_players: true },
      },
    }],
  }))
}

async function runUpdater(baseUrl, extraEnvironment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [updaterPath, '--mode', 'full', '--dry-run'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        FOOTBALL_DATA_PROVIDER: 'api-football',
        API_FOOTBALL_KEY: 'integration-test-key',
        API_FOOTBALL_BASE_URL: baseUrl,
        ...extraEnvironment,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

test('full updater validates a complete mocked API sync without replacing the snapshot in dry-run mode', { timeout: 15_000 }, async (context) => {
  const calls = []
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    calls.push(`${url.pathname}?${url.searchParams}`)
    let body

    if (url.pathname === '/teams') {
      body = responseWrapper([{ team: { id: 529, name: 'Barcelona', country: 'Spain', national: false } }])
    } else if (url.pathname === '/leagues') {
      body = responseWrapper(leaguesResponse())
    } else if (url.pathname === '/fixtures' && url.searchParams.has('team')) {
      body = responseWrapper(bulkFixtures)
    } else if (url.pathname === '/fixtures' && url.searchParams.has('ids')) {
      const ids = new Set(url.searchParams.get('ids').split('-').map(Number))
      body = responseWrapper(detailedFixtures.filter((fixture) => ids.has(fixture.fixture.id)))
    } else if (url.pathname === '/players') {
      body = responseWrapper(playerRows())
    } else if (url.pathname === '/standings') {
      body = responseWrapper(standingsResponse(Number(url.searchParams.get('league'))))
    } else {
      response.statusCode = 404
      body = responseWrapper([], undefined)
      body.errors = { route: `Unexpected ${url.pathname}` }
    }

    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(body))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const address = server.address()
  const before = await readFile(snapshotPath, 'utf8')
  const result = await runUpdater(`http://127.0.0.1:${address.port}`)
  const rollover = await runUpdater(`http://127.0.0.1:${address.port}`, {
    API_FOOTBALL_SEASON: '2027',
  })
  const after = await readFile(snapshotPath, 'utf8')

  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Validated API changes successfully \(dry run\)/)
  assert.equal(rollover.code, 0, rollover.stderr || rollover.stdout)
  assert.match(rollover.stdout, /Validated API changes successfully \(dry run\)/)
  assert.equal(after, before)
  assert.ok(calls.some((call) => call.startsWith('/teams?')))
  assert.ok(calls.some((call) => call.startsWith('/fixtures?ids=')))
  assert.equal(calls.filter((call) => call.startsWith('/standings?')).length, 2)
})
