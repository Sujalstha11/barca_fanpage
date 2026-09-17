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
const localPlayerById = new Map(players.map((player) => [player.id, player]))
const goalTeam = { id: 'barcelona-team', apiId: 529, name: 'Barcelona', country: 'Spain' }

function goalWrapper(data, pagination = null) {
  return { success: true, data, pagination }
}

function listWrapper(data) {
  return goalWrapper(data, {
    total: data.length,
    limit: 500,
    offset: 0,
    hasMore: false,
  })
}

function providerPlayerId(localId) {
  return 10_000 + Number(localId)
}

function providerPlayerKey(localId) {
  return `player-${localId}`
}

function opponentApiId(name) {
  return 20_000 + [...name].reduce((total, character) => total + character.codePointAt(0), 0)
}

function opponentKey(name) {
  return `team-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function competitionDetails(name) {
  return name === 'Champions League'
    ? { id: 'ucl', apiId: 3, name: 'Champions League' }
    : { id: 'lal', apiId: 302, name: 'La Liga' }
}

function teamFields(entry, side) {
  const name = entry[side]
  const configured = entry[`${side}Code`] === 'BAR'
  return {
    [`${side}TeamId`]: configured ? goalTeam.id : opponentKey(name),
    [`${side}TeamApiId`]: configured ? goalTeam.apiId : opponentApiId(name),
    [`${side}TeamName`]: configured ? goalTeam.name : name,
  }
}

function roundFields(entry) {
  const number = String(entry.round).match(/(\d+)/)?.[1] || '1'
  return {
    matchRound: number,
    stageName: entry.competition === 'Champions League' ? 'League Phase' : 'Regular Season',
  }
}

function goalFixture(entry, index) {
  const completed = Number.isInteger(entry.homeScore) && Number.isInteger(entry.awayScore)
  const competition = competitionDetails(entry.competition)
  return {
    id: `fixture-${index + 1}`,
    apiId: 30_000 + index,
    kickoffUtc: entry.kickoff || `${entry.date}T19:00:00Z`,
    leagueId: competition.id,
    leagueName: competition.name,
    leagueYear: '2026/2027',
    matchStatus: completed ? 'FINISHED' : 'SCHEDULED',
    matchStadium: entry.venue,
    ...roundFields(entry),
    ...teamFields(entry, 'home'),
    ...teamFields(entry, 'away'),
    homeTeamScore: completed ? entry.homeScore : null,
    awayTeamScore: completed ? entry.awayScore : null,
    homeTeamFtScore: completed ? entry.homeScore : null,
    awayTeamFtScore: completed ? entry.awayScore : null,
  }
}

const fixtureEntries = [...snapshot.results, ...snapshot.fixtures]
const goalFixtures = fixtureEntries.map(goalFixture)
const fixtureEntryByKey = new Map(goalFixtures.map((fixture, index) => [fixture.id, fixtureEntries[index]]))

function eventSide(entry, goal) {
  const creditedSide = goal.teamCode === entry.homeCode ? 'home' : 'away'
  if (goal.type !== 'own-goal') return creditedSide
  return creditedSide === 'home' ? 'away' : 'home'
}

function goalEvent(entry, goal) {
  const side = eventSide(entry, goal)
  const info = {
    penalty: 'Penalty',
    'own-goal': 'Own Goal',
    'free-kick': 'Free Kick',
  }[goal.type] || 'Open Play'
  return {
    time: goal.minute,
    type: 'Goal',
    info,
    homeScorer: side === 'home' ? goal.scorer : null,
    awayScorer: side === 'away' ? goal.scorer : null,
    homeAssist: side === 'home' ? goal.assist : null,
    awayAssist: side === 'away' ? goal.assist : null,
  }
}

const goalPlayers = snapshot.playerStats.map((stat) => {
  const player = localPlayerById.get(Number(stat.playerId))
  return {
    id: providerPlayerKey(stat.playerId),
    apiId: providerPlayerId(stat.playerId),
    name: player.name,
    number: player.number,
    type: player.position,
    image: `https://example.test/${stat.playerId}.png`,
    matchPlayed: stat.appearances,
    starts: stat.starts,
    minutes: stat.minutes,
    goals: stat.goals,
    assists: stat.assists,
  }
})

function lineups() {
  const startingLineups = goalPlayers.slice(0, 11).map((player) => ({
    playerId: player.id,
    playerKey: player.apiId,
    lineupPlayer: player.name,
  }))
  return {
    hasLineups: true,
    home: { startingLineups },
    away: { startingLineups },
  }
}

function goalStandings() {
  const barcelona = snapshot.standings.find((entry) => entry.id === 'la-liga')
  return Array.from({ length: 20 }, (_, index) => {
    const position = index + 1
    const configured = position === barcelona.position
    return {
      teamId: configured ? goalTeam.id : `lal-team-${position}`,
      teamApiId: configured ? goalTeam.apiId : 40_000 + position,
      teamName: configured ? goalTeam.name : (position === 2 ? 'Real Madrid' : `La Liga Team ${position}`),
      overallLeaguePosition: position,
      overallLeaguePlayed: configured ? barcelona.played : 6,
      overallLeagueW: configured ? barcelona.wins : 0,
      overallLeagueD: configured ? barcelona.draws : 6,
      overallLeagueL: configured ? barcelona.losses : 0,
      overallLeagueGF: configured ? barcelona.goalsFor : 0,
      overallLeagueGA: configured ? barcelona.goalsAgainst : 0,
      overallLeaguePTS: configured ? barcelona.points : Math.max(0, barcelona.points - position - 1),
    }
  })
}

function barcaStandings() {
  const barcelona = snapshot.standings.find((entry) => entry.id === 'champions-league')
  return Array.from({ length: 36 }, (_, index) => {
    const position = index + 1
    const configured = position === barcelona.position
    return {
      team: {
        id: configured ? goalTeam.id : `ucl-team-${position}`,
        name: configured ? goalTeam.name : `Champions League Team ${position}`,
      },
      position,
      played: configured ? barcelona.played : 1,
      won: configured ? barcelona.wins : 0,
      drawn: configured ? barcelona.draws : 1,
      lost: configured ? barcelona.losses : 0,
      goalsFor: configured ? barcelona.goalsFor : 0,
      goalsAgainst: configured ? barcelona.goalsAgainst : 0,
      points: configured ? barcelona.points : 1,
    }
  })
}

async function runUpdater(origin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [updaterPath, '--mode', 'full', '--dry-run'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        FOOTBALL_DATA_PROVIDER: 'goal-api',
        GOAL_API_KEY: 'goal-integration-secret',
        GOAL_API_BASE_URL: `${origin}/v1`,
        BARCA_API_BASE_URL: origin,
        FOOTBALL_DATA_SEASON: '2026',
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

test('full GOAL provider update uses authenticated data and the public UCL fallback without writing in dry-run mode', { timeout: 20_000 }, async (context) => {
  const calls = []
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    calls.push({
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization: request.headers.authorization || null,
    })

    let body
    if (url.pathname === '/v1/teams') {
      body = listWrapper([goalTeam])
    } else if (url.pathname === '/v1/fixtures') {
      body = listWrapper(goalFixtures)
    } else if (url.pathname === '/v1/leagues/lal') {
      body = goalWrapper({ id: 'lal', apiId: 302, name: 'La Liga' })
    } else if (url.pathname === '/v1/leagues/ucl') {
      body = goalWrapper({ id: 'ucl', apiId: 3, name: 'Champions League' })
    } else if (url.pathname === `/v1/teams/${goalTeam.id}/players`) {
      body = listWrapper(goalPlayers)
    } else if (/^\/v1\/fixtures\/fixture-\d+\/lineups$/.test(url.pathname)) {
      body = goalWrapper(lineups())
    } else if (/^\/v1\/fixtures\/fixture-\d+\/events$/.test(url.pathname)) {
      const fixtureKey = url.pathname.split('/')[3]
      const entry = fixtureEntryByKey.get(fixtureKey)
      body = goalWrapper((entry?.goals || []).map((goal) => goalEvent(entry, goal)))
    } else if (url.pathname === '/v1/standings/lal') {
      body = goalWrapper(goalStandings())
    } else if (url.pathname === '/v1/standings/ucl') {
      response.statusCode = 403
      body = {
        success: false,
        error: { message: 'Standings are unavailable for this competition', code: 'NO_COVERAGE' },
      }
    } else if (url.pathname === '/api/standings') {
      body = { data: barcaStandings() }
    } else {
      response.statusCode = 404
      body = { success: false, error: { message: `Unexpected route ${url.pathname}` } }
    }

    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(body))
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise((resolve) => server.close(resolve)))
  const address = server.address()
  const origin = `http://127.0.0.1:${address.port}`
  const before = await readFile(snapshotPath, 'utf8')
  const result = await runUpdater(origin)
  const after = await readFile(snapshotPath, 'utf8')

  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /Validated GOAL API changes successfully \(dry run\)/)
  assert.equal(after, before)

  const goalCalls = calls.filter((call) => call.pathname.startsWith('/v1/'))
  const publicCalls = calls.filter((call) => call.pathname.startsWith('/api/'))
  assert.ok(goalCalls.length > 0)
  assert.ok(goalCalls.every((call) => call.authorization === 'Bearer goal-integration-secret'))
  assert.deepEqual(publicCalls.map((call) => call.authorization), [null])

  assert.ok(calls.some((call) => call.pathname === '/v1/teams'
    && call.query.search === 'Barcelona'
    && call.query.country === 'Spain'))
  assert.ok(calls.some((call) => call.pathname === '/v1/fixtures'
    && call.query.teamId === goalTeam.id
    && call.query.from === '2026-07-01'
    && call.query.to === '2027-06-30'))
  assert.ok(calls.some((call) => call.pathname === '/v1/leagues/lal'))
  assert.ok(calls.some((call) => call.pathname === '/v1/leagues/ucl'))
  assert.ok(calls.some((call) => call.pathname === `/v1/teams/${goalTeam.id}/players`))
  assert.equal(calls.filter((call) => /\/lineups$/.test(call.pathname)).length, snapshot.results.length)
  assert.equal(calls.filter((call) => /\/events$/.test(call.pathname)).length, snapshot.results.length)
  assert.ok(calls.some((call) => call.pathname === '/v1/standings/lal'))
  assert.ok(calls.some((call) => call.pathname === '/v1/standings/ucl'))
  assert.deepEqual(publicCalls.map(({ pathname, query }) => ({ pathname, query })), [{
    pathname: '/api/standings',
    query: { competition: 'UCL', season: '2026' },
  }])
})
