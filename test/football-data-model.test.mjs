import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  aggregatePlayerStats,
  fixtureOutcome,
  fixtureToSnapshotEntries,
  formatEventMinute,
  hasCanonicalChanges,
  mapGoalEvent,
  mapProviderPlayers,
  normalizeName,
  normalizeStandings,
  shouldRunScheduled,
  snapshotValidationErrors,
  teamCodeFor,
  validateSnapshot,
} from '../scripts/football-data/model.mjs'
import {
  assertCompleteSeasonResponse,
  assertFreshStandings,
} from '../scripts/update-football-data.mjs'

const snapshot = JSON.parse(await readFile(
  new URL('../src/data/generated/snapshot.json', import.meta.url),
  'utf8',
))

function providerFixture(overrides = {}) {
  return {
    fixture: {
      id: 9001,
      date: '2026-09-19T19:00:00+00:00',
      timestamp: 1789844400,
      venue: { name: 'Ramón Sánchez-Pizjuán' },
      status: { short: 'FT' },
    },
    league: { id: 140, name: 'La Liga', round: 'Regular Season - 7' },
    teams: {
      home: { id: 536, name: 'Sevilla FC' },
      away: { id: 529, name: 'Barcelona' },
    },
    goals: { home: 1, away: 2 },
    events: [],
    ...overrides,
  }
}

test('normalizes accented names, resolves known team codes, and formats added time', () => {
  assert.equal(normalizeName('  João  Cancelo '), 'joao cancelo')
  assert.equal(teamCodeFor({ name: 'FC Barcelona' }), 'BAR')
  assert.equal(formatEventMinute({ time: { elapsed: 90, extra: 4 } }), '90+4')
})

test('maps goals safely, including own goals and penalties, but excludes missed penalties', () => {
  const resolvePlayerId = (player) => `api-${player.id}`
  const penalty = mapGoalEvent({
    time: { elapsed: 67, extra: null },
    team: { name: 'Barcelona' },
    player: { id: 22, name: 'Raphinha' },
    assist: { id: null, name: null },
    type: 'Goal',
    detail: 'Penalty',
  }, { resolvePlayerId })
  assert.deepEqual(penalty, {
    teamCode: 'BAR',
    minute: '67',
    scorer: 'Raphinha',
    scorerId: 'api-22',
    assist: null,
    assistId: null,
    type: 'penalty',
  })

  assert.equal(mapGoalEvent({ type: 'Goal', detail: 'Missed Penalty' }), null)
  const ownGoal = mapGoalEvent({
    time: { elapsed: 36 },
    team: { id: 700, name: 'Racing Santander' },
    player: { name: 'Opponent' },
    type: 'Goal',
    detail: 'Own Goal',
  }, {
    fixtureTeams: {
      home: { id: 529, name: 'Barcelona' },
      away: { id: 700, name: 'Racing Santander' },
    },
  })
  assert.equal(ownGoal?.type, 'own-goal')
  assert.equal(ownGoal?.teamCode, 'BAR')
  assert.equal(mapGoalEvent({ type: 'Goal', detail: 'Penalty', comments: 'Penalty Shootout' }), null)
})

test('uses the shootout winner instead of recording a draw after penalties', () => {
  const fixture = providerFixture({
    fixture: {
      id: 9002,
      date: '2026-12-12T20:00:00Z',
      timestamp: 1797105600,
      venue: { name: 'Final venue' },
      status: { short: 'PEN' },
    },
    goals: { home: 1, away: 1 },
    score: { penalty: { home: 3, away: 4 } },
  })
  assert.equal(fixtureOutcome(fixture, 529), 'win')
  const converted = fixtureToSnapshotEntries([fixture], { teamId: 529 })
  assert.equal(converted.results[0].outcome, 'W')
  assert.equal(converted.results[0].homePenaltyScore, 3)
  assert.equal(converted.results[0].awayPenaltyScore, 4)
})

test('converts provider fixtures and preserves a matching local match id', () => {
  const fixture = providerFixture({
    events: [{
      time: { elapsed: 90, extra: 3 },
      team: { name: 'Barcelona' },
      player: { id: 101, name: 'Winner' },
      assist: { id: 102, name: 'Creator' },
      type: 'Goal',
      detail: 'Normal Goal',
    }],
  })
  const previous = {
    id: 'sevilla-fcb-2026',
    providerId: null,
    status: 'NS',
    date: '2026-09-19',
    kickoff: '2026-09-19T19:00:00Z',
    confirmed: true,
    home: 'Sevilla',
    homeCode: 'SEV',
    away: 'Barcelona',
    awayCode: 'BAR',
    venue: 'Ramón Sánchez-Pizjuán',
    competition: 'La Liga',
    round: 'Matchday 7',
  }
  const competition = { providerLeagueId: 140, id: 'la-liga', name: 'La Liga' }
  const converted = fixtureToSnapshotEntries([fixture], {
    teamId: 529,
    competitionByLeagueId: new Map([[140, competition]]),
    existingFixtures: [previous],
    resolvePlayerId: (player) => `api-${player.id}`,
  })

  assert.equal(converted.fixtures.length, 0)
  assert.equal(converted.results[0].id, 'sevilla-fcb-2026')
  assert.equal(converted.results[0].providerId, 9001)
  assert.equal(converted.results[0].providerLeagueId, 140)
  assert.equal(converted.results[0].round, 'Matchday 7')
  assert.equal(converted.results[0].goals[0].minute, '90+3')
  assert.equal(fixtureOutcome(fixture, 529), 'win')
})

test('maps known players locally, creates stable provider players, and aggregates all pages', () => {
  const rows = [
    {
      player: { id: 111, name: 'Raphinha', photo: 'https://example.test/raphinha.png' },
      statistics: [{
        team: { id: 529 },
        league: { id: 140, name: 'La Liga' },
        games: { appearences: 2, lineups: 2, minutes: 170, number: 11, position: 'Attacker' },
        goals: { total: 3, assists: 1 },
      }],
    },
    {
      player: { id: 222, name: 'Academy Prospect', photo: null },
      statistics: [{
        team: { id: 529 },
        league: { id: 2, name: 'Champions League' },
        games: { appearences: 1, lineups: 0, minutes: 12, number: 42, position: 'Midfielder' },
        goals: { total: 0, assists: 1 },
      }],
    },
  ]
  const mapping = mapProviderPlayers(rows, [
    { id: 22, name: 'Raphinha', shortName: 'Raphinha', number: 11, position: 'Forward', role: 'Left wing' },
  ])

  assert.equal(mapping.resolvePlayerId({ id: 111 }), 22)
  assert.equal(mapping.resolvePlayerId({ id: 222 }), 'api-222')
  assert.equal(mapping.providerPlayers[1].id, 'api-222')
  assert.equal(mapping.providerPlayers[1].number, 42)

  const stats = aggregatePlayerStats(rows, {
    teamId: 529,
    leagueIds: new Set([140, 2]),
    resolvePlayerId: mapping.resolvePlayerId,
  })
  assert.deepEqual(stats, [
    { playerId: 22, appearances: 2, starts: 2, minutes: 170, goals: 3, assists: 1 },
    { playerId: 'api-222', appearances: 1, starts: 0, minutes: 12, goals: 0, assists: 1 },
  ])
})

test('extracts Barcelona from nested standings and keeps W/D/L form order', () => {
  const apiResponse = [{
    league: {
      id: 140,
      name: 'La Liga',
      season: 2026,
      standings: [[
        { rank: 1, team: { id: 529, name: 'Barcelona' }, points: 10, goalsDiff: 7, form: 'WDLW', all: { played: 4, win: 2, draw: 1, lose: 1, goals: { for: 9, against: 2 } } },
        { rank: 2, team: { id: 541, name: 'Real Madrid' }, points: 8, goalsDiff: 4, form: 'WWDD', all: { played: 4, win: 2, draw: 2, lose: 0, goals: { for: 7, against: 3 } } },
      ]],
    },
  }]
  const standing = normalizeStandings(apiResponse, {
    teamId: 529,
    competition: {
      providerLeagueId: 140,
      id: 'la-liga',
      name: 'La Liga',
      season: '2026/27',
      totalMatchdays: 38,
      sourceLabel: 'Official',
      sourceUrl: 'https://example.test',
    },
  })

  assert.deepEqual(standing.form, ['W', 'D', 'L', 'W'])
  assert.equal(standing.stage, 'Matchday 4 of 38')
  assert.equal(standing.standingNote, '2 points clear of Real Madrid')
})

test('scheduled gating uses the post-kickoff window and ignores ordinary no-op runs', () => {
  const monitored = {
    fixtures: [{ kickoff: '2026-09-19T19:00:00Z', status: 'NS' }],
  }
  const config = { scheduledWindowStartMinutes: 95, scheduledWindowEndMinutes: 360 }
  assert.equal(shouldRunScheduled(monitored, new Date('2026-09-19T20:00:00Z'), config), false)
  assert.equal(shouldRunScheduled(monitored, new Date('2026-09-19T20:40:00Z'), config), true)
  assert.equal(shouldRunScheduled(monitored, new Date('2026-09-20T02:00:00Z'), config), false)
})

test('provider baselines reject a response that silently drops the future schedule', () => {
  const baseline = structuredClone(snapshot)
  baseline.source.name = 'api-football'
  baseline.results.forEach((result, index) => { result.providerId = 1000 + index })
  baseline.fixtures.forEach((fixture, index) => { fixture.providerId = 2000 + index })
  const resultFixtures = baseline.results.map((result) => ({
    fixture: { id: result.providerId, date: `${result.date}T19:00:00Z`, status: { short: result.status } },
    league: { id: result.providerLeagueId || 140, name: result.competition },
    teams: {
      home: { id: result.homeCode === 'BAR' ? 529 : 800, name: result.home },
      away: { id: result.awayCode === 'BAR' ? 529 : 801, name: result.away },
    },
    goals: { home: result.homeScore, away: result.awayScore },
  }))

  assert.throws(
    () => assertCompleteSeasonResponse(resultFixtures, baseline, { teamId: 529, season: 2026 }),
    /omitted scheduled fixture data/,
  )
})

test('standings freshness ignores knockout matches after a capped table phase', () => {
  const standing = { ...snapshot.standings[1], played: 1 }
  const competition = { providerLeagueId: 2, totalMatchdays: 8 }
  const results = [
    { providerLeagueId: 2, round: 'League phase · Matchday 1' },
    ...Array.from({ length: 10 }, () => ({ providerLeagueId: 2, round: 'Round of 16' })),
  ]
  assert.doesNotThrow(() => assertFreshStandings([standing], results, [competition]))
  assert.throws(
    () => assertFreshStandings([standing], [
      ...results,
      { providerLeagueId: 2, round: 'League phase · Matchday 2' },
    ], [competition]),
    /standings are stale/,
  )
})

test('canonical comparison ignores sync timestamps but detects recent-form sequence changes', () => {
  const next = structuredClone(snapshot)
  next.generatedAt = '2027-01-01T00:00:00Z'
  next.source.lastSuccessfulSync = '2027-01-01T00:00:00Z'
  assert.equal(hasCanonicalChanges(snapshot, next), false)

  const reordered = structuredClone(snapshot)
  reordered.standings[0].form = ['W', 'D', 'L']
  const differentOrder = structuredClone(reordered)
  differentOrder.standings[0].form = ['L', 'D', 'W']
  assert.equal(hasCanonicalChanges(reordered, differentOrder), true)
})

test('snapshot validation accepts the seed and rejects inconsistent player statistics', () => {
  assert.equal(validateSnapshot(snapshot), snapshot)
  const invalid = structuredClone(snapshot)
  invalid.playerStats[0].starts = invalid.playerStats[0].appearances + 1
  assert.ok(snapshotValidationErrors(invalid).some((message) => message.includes('starts cannot exceed appearances')))
  assert.throws(() => validateSnapshot(invalid), /Football data validation failed/)

  const invalidShootout = structuredClone(snapshot)
  invalidShootout.results[0].status = 'PEN'
  invalidShootout.results[0].outcome = 'W'
  assert.ok(snapshotValidationErrors(invalidShootout).some((message) => message.includes('decisive penalty-shootout score')))

  invalidShootout.results[0].homePenaltyScore = 3
  invalidShootout.results[0].awayPenaltyScore = 4
  assert.ok(snapshotValidationErrors(invalidShootout).some((message) => message.includes('outcome must agree')))
})
