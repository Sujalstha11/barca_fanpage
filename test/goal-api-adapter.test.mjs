import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adaptBarcaStandings,
  adaptGoalFixture,
  adaptGoalPlayers,
  adaptGoalStandings,
  goalSeasonLabel,
  goalStatusToApiFootball,
  positiveNumericId,
} from '../scripts/football-data/goal-api-adapter.mjs'
import { mapGoalEvents, normalizeStandings } from '../scripts/football-data/model.mjs'

test('formats GOAL seasons and converts provider ids to stable positive integers', () => {
  assert.equal(goalSeasonLabel(2026), '2026/2027')
  assert.equal(goalSeasonLabel('2026/27'), '2026/2027')
  assert.equal(positiveNumericId('829288'), 829288)

  const hashed = positiveNumericId('cmr7uopa08np1rx06rjek9er9')
  assert.ok(Number.isInteger(hashed) && hashed > 0)
  assert.equal(hashed, positiveNumericId('cmr7uopa08np1rx06rjek9er9'))
  assert.equal(positiveNumericId(null, 'fallback-id'), positiveNumericId(undefined, 'fallback-id'))
})

test('maps the official GOAL fixture lifecycle and live periods to API-Football statuses', () => {
  assert.equal(goalStatusToApiFootball('SCHEDULED'), 'NS')
  assert.equal(goalStatusToApiFootball('FINISHED'), 'FT')
  assert.equal(goalStatusToApiFootball('AFTER_ET'), 'AET')
  assert.equal(goalStatusToApiFootball('AFTER_PEN'), 'PEN')
  assert.equal(goalStatusToApiFootball('LIVE', 'FIRST_HALF'), '1H')
  assert.equal(goalStatusToApiFootball('LIVE', 'HALF_TIME'), 'HT')
  assert.equal(goalStatusToApiFootball('LIVE', 'SECOND_HALF'), '2H')
  assert.equal(goalStatusToApiFootball('LIVE', 'EXTRA_TIME'), 'ET')
  assert.equal(goalStatusToApiFootball('LIVE', 'PENALTIES'), 'P')
  assert.equal(goalStatusToApiFootball('POSTPONED'), 'PST')
  assert.equal(goalStatusToApiFootball('CANCELLED'), 'CANC')
  assert.equal(goalStatusToApiFootball('AWARDED'), 'AWD')
  assert.equal(goalStatusToApiFootball('ABANDONED'), 'ABD')
  assert.equal(goalStatusToApiFootball('SUSPENDED'), 'SUSP')
})

test('adapts a GOAL fixture, score and goal-only timeline to the existing provider shape', () => {
  const fixture = adaptGoalFixture({
    id: 'internal-fixture-id',
    apiId: '829288',
    kickoffUtc: '2026-09-16T19:00:00.000Z',
    matchDate: '2026-09-16',
    matchTime: '19:00',
    matchStatus: 'AFTER_PEN',
    matchPeriod: 'FINISHED',
    matchElapsed: 120,
    matchRound: '1',
    stageName: 'League Phase',
    matchStadium: 'Spotify Camp Nou',
    leagueId: 'goal-ucl-id',
    leagueName: 'UEFA Champions League',
    leagueYear: '2026/2027',
    countryName: 'Europe',
    homeTeamId: 'goal-barcelona-id',
    homeTeamName: 'FC Barcelona',
    homeTeamScore: '2',
    homeTeamPenaltyScore: '4',
    awayTeamId: 'goal-sevilla-id',
    awayTeamName: 'Sevilla FC',
    awayTeamScore: '2',
    awayTeamPenaltyScore: '3',
    events: [
      { time: '12', type: 'goal', homeScorer: 'Raphinha', homeAssist: 'Pedri' },
      { time: '45+2', type: 'goal', awayScorer: 'Dodi Lukebakio', info: 'Penalty' },
      { time: '78', type: 'goal', homeScorer: 'Raphinha', info: 'Free kick' },
      { time: '89', type: 'goal', awayScorer: 'Opponent Defender', info: 'Own Goal' },
      { time: '90', type: 'yellow card', homeScorer: 'Not a scorer' },
      { time: '90+4', type: 'substitution', awayScorer: 'Not a scorer either' },
      { time: '120', type: 'goal', homeScorer: 'Penalty taker', info: 'Penalty shootout' },
    ],
  }, {
    teamProviderId: 'goal-barcelona-id',
    teamNumericId: 529,
    leagueByProviderId: new Map([['goal-ucl-id', {
      providerLeagueId: 3,
      name: 'Champions League',
      type: 'Cup',
    }]]),
    playerByName: new Map([
      ['raphinha', 22],
      ['pedri', 8],
      ['dodi lukebakio', 101],
      ['opponent defender', 102],
    ]),
  })

  assert.equal(fixture.fixture.id, 829288)
  assert.equal(fixture.fixture.date, '2026-09-16T19:00:00.000Z')
  assert.equal(fixture.fixture.status.short, 'PEN')
  assert.equal(fixture.fixture.venue.name, 'Spotify Camp Nou')
  assert.deepEqual(fixture.league, {
    id: 3,
    name: 'Champions League',
    type: 'Cup',
    country: 'Europe',
    logo: null,
    flag: null,
    season: 2026,
    round: 'League Phase - 1',
  })
  assert.equal(fixture.teams.home.id, 529)
  assert.equal(fixture.teams.home.code, 'BAR')
  assert.equal(fixture.teams.home.winner, true)
  assert.equal(fixture.teams.away.code, 'SEV')
  assert.equal(fixture.teams.away.winner, false)
  assert.deepEqual(fixture.goals, { home: 2, away: 2 })
  assert.deepEqual(fixture.score.penalty, { home: 4, away: 3 })
  assert.equal(fixture.events.length, 4)
  assert.deepEqual(fixture.events[0], {
    time: { elapsed: 12, extra: null },
    team: fixture.teams.home,
    player: { id: 22, name: 'Raphinha' },
    assist: { id: 8, name: 'Pedri' },
    type: 'Goal',
    detail: 'Normal Goal',
    comments: null,
  })
  assert.equal(fixture.events[1].detail, 'Penalty')
  assert.deepEqual(fixture.events[1].time, { elapsed: 45, extra: 2 })
  assert.equal(fixture.events[2].detail, 'Free Kick')
  assert.equal(fixture.events[3].detail, 'Own Goal')
  assert.equal(fixture.events[3].team.id, fixture.teams.home.id)
  assert.equal(mapGoalEvents(fixture.events, { fixtureTeams: fixture.teams })[3].teamCode, 'SEV')
})

test('uses matchDate and matchTime as an explicitly UTC fixture fallback', () => {
  const fixture = adaptGoalFixture({
    id: 'fixture-without-kickoff-utc',
    matchDate: '2026-12-01',
    matchTime: '20:30',
    matchStatus: 'SCHEDULED',
    leagueId: 'league',
    leagueName: 'La Liga',
    homeTeamId: 'barca',
    homeTeamName: 'Barcelona',
    awayTeamId: 'opponent',
    awayTeamName: 'Getafe',
  }, { teamProviderId: 'barca', teamNumericId: 529 })

  assert.equal(fixture.fixture.date, '2026-12-01T20:30:00.000Z')
  assert.equal(fixture.fixture.status.short, 'NS')
})

test('adapts raw GOAL squad statistics and lineup-derived starts', () => {
  const players = adaptGoalPlayers([
    {
      id: 'goal-player-raphinha',
      apiId: '1477558463',
      name: 'Raphinha',
      image: 'https://example.test/raphinha.jpg',
      number: '11',
      type: 'Forwards',
      matchPlayed: '6',
      minutes: '521',
      goals: '7',
      assists: '3',
    },
  ], {
    teamNumericId: 529,
    leagueNumericId: 302,
    startsByProviderId: new Map([['goal-player-raphinha', 5]]),
  })

  assert.equal(players[0].player.id, 1477558463)
  assert.equal(players[0].player.photo, 'https://example.test/raphinha.jpg')
  assert.deepEqual(players[0].statistics[0], {
    team: { id: 529 },
    league: { id: 302 },
    games: {
      appearences: 6,
      appearances: 6,
      lineups: 5,
      starts: 5,
      minutes: 521,
      number: 11,
      position: 'Forwards',
    },
    goals: { total: 7, assists: 3 },
  })
})

test('adapts GOAL string standings into the shape normalizeStandings consumes', () => {
  const competition = {
    providerLeagueId: 302,
    id: 'la-liga',
    name: 'La Liga',
    season: '2026/2027',
    totalMatchdays: 38,
    sourceLabel: 'GOAL API standings',
    sourceUrl: 'https://goal-api.com/coverage/spain-la-liga-api',
  }
  const response = adaptGoalStandings([
    {
      teamId: 'goal-barca-id',
      teamName: 'Barcelona',
      stageName: 'Current',
      overallLeaguePosition: '1',
      overallLeaguePlayed: '6',
      overallLeagueW: '5',
      overallLeagueD: '1',
      overallLeagueL: '0',
      overallLeagueGF: '20',
      overallLeagueGA: '5',
      overallLeaguePTS: '16',
      overallPromotion: 'Champions League',
    },
    {
      teamId: 'goal-madrid-id',
      teamName: 'Real Madrid',
      overallLeaguePosition: '2',
      overallLeaguePlayed: '6',
      overallLeagueW: '4',
      overallLeagueD: '2',
      overallLeagueL: '0',
      overallLeagueGF: '14',
      overallLeagueGA: '4',
      overallLeaguePTS: '14',
    },
  ], {
    teamNumericId: 529,
    teamProviderId: 'goal-barca-id',
    competition,
    form: ['win', 'draw', 'loss'],
  })

  assert.equal(response[0].league.id, 302)
  assert.equal(response[0].league.standings[0][0].team.id, 529)
  assert.equal(response[0].league.standings[0][0].goalsDiff, 15)
  assert.equal(response[0].league.standings[0][0].form, 'WDL')
  assert.ok(response[0].league.standings[0][1].team.id > 0)

  const standing = normalizeStandings(response, { teamId: 529, competition })
  assert.equal(standing.position, 1)
  assert.equal(standing.played, 6)
  assert.equal(standing.goalDifference, 15)
  assert.deepEqual(standing.form, ['W', 'D', 'L'])
  assert.equal(standing.standingNote, '2 points clear of Real Madrid')
})

test('adapts Barça API standings and identifies Barcelona by name when no id is present', () => {
  const competition = {
    providerLeagueId: 3,
    id: 'champions-league',
    name: 'Champions League',
    season: '2026/2027',
    totalMatchdays: 8,
    sourceLabel: 'Barça API standings',
    sourceUrl: 'https://api.fc-barcelona.app/en/docs',
  }
  const response = adaptBarcaStandings([
    {
      position: '1',
      team: 'Manchester City',
      played: '1',
      won: '1',
      drawn: '0',
      lost: '0',
      goalsFor: '4',
      goalsAgainst: '0',
      goalDifference: '4',
      points: '3',
    },
    {
      position: '3',
      team: 'FC Barcelona',
      played: '1',
      won: '1',
      drawn: '0',
      lost: '0',
      goalsFor: '7',
      goalsAgainst: '2',
      goalDifference: '999',
      points: '3',
    },
  ], {
    teamNumericId: 529,
    teamProviderId: 'unused-internal-id',
    competition,
    form: 'W,D',
  })

  const table = response[0].league.standings[0]
  assert.equal(table[1].team.id, 529)
  assert.equal(table[1].goalsDiff, 5)
  assert.equal(table[1].form, 'WD')

  const standing = normalizeStandings(response, { teamId: 529, competition })
  assert.equal(standing.position, 3)
  assert.equal(standing.competition, 'Champions League')
  assert.equal(standing.goalDifference, 5)
  assert.deepEqual(standing.form, ['W', 'D'])
})
