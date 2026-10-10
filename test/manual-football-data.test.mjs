import assert from 'node:assert/strict'
import test from 'node:test'
import { buildManualSnapshot, leaguePlayerRows, europeanPlayerRows } from '../scripts/football-data/manual-2026-10-10.mjs'
import { validateSnapshot } from '../scripts/football-data/model.mjs'

const snapshot = buildManualSnapshot()

test('reviewed results reconcile with every goal event, player total and league table', () => {
  validateSnapshot(snapshot)
  const contributions = new Map()
  for (const result of snapshot.results) {
    assert.ok(result.date <= snapshot.source.dataThrough)
    assert.equal(result.goals.filter((goal) => goal.teamCode === result.homeCode).length, result.homeScore)
    assert.equal(result.goals.filter((goal) => goal.teamCode === result.awayCode).length, result.awayScore)
    for (const goal of result.goals) {
      if (goal.teamCode !== 'BAR' || goal.type === 'own-goal') continue
      assert.ok(goal.scorerId, `Missing player reference for ${goal.scorer}`)
      for (const [id, key] of [[goal.scorerId, 'goals'], [goal.assistId, 'assists']]) {
        if (id === null) continue
        const row = contributions.get(id) || { goals: 0, assists: 0 }
        row[key] += 1
        contributions.set(id, row)
      }
    }
  }
  for (const stat of snapshot.playerStats) {
    assert.ok(stat.appearances <= snapshot.results.length)
    assert.ok(stat.minutes <= stat.appearances * 100)
    assert.equal(stat.goals, contributions.get(stat.playerId)?.goals || 0)
    assert.equal(stat.assists, contributions.get(stat.playerId)?.assists || 0)
    contributions.delete(stat.playerId)
  }
  assert.equal(contributions.size, 0, 'Every goal contributor has a statistics row')
  for (const standing of snapshot.standings) {
    const matches = snapshot.results.filter((result) => result.competition === standing.competition)
    assert.equal(standing.played, matches.length)
    assert.equal(standing.wins, matches.filter((result) => result.outcome === 'W').length)
    assert.equal(standing.points, standing.wins * 3 + standing.draws)
    assert.equal(standing.goalsFor, matches.reduce((sum, match) => sum + (match.homeCode === 'BAR' ? match.homeScore : match.awayScore), 0))
    assert.equal(standing.goalsAgainst, matches.reduce((sum, match) => sum + (match.homeCode === 'BAR' ? match.awayScore : match.homeScore), 0))
  }
  assert.equal(leaguePlayerRows.reduce((sum, row) => sum + row[2], 0), 7 * 11)
  assert.equal(europeanPlayerRows.reduce((sum, row) => sum + row[2], 0), 11)
})

test('reviewed schedule includes the complete league season without invented kickoff times', () => {
  const leagueMatches = [...snapshot.results, ...snapshot.fixtures].filter((match) => match.competition === 'La Liga')
  assert.equal(leagueMatches.length, 38)
  assert.equal(new Set(leagueMatches.map((match) => match.round)).size, 38)
  assert.equal(snapshot.fixtures[0].date, '2026-10-10')
  assert.ok(!snapshot.fixtures.some((fixture) => fixture.date < '2026-10-10'))
  const alaves = snapshot.fixtures.find((fixture) => fixture.homeCode === 'BAR' && fixture.awayCode === 'ALA')
  assert.equal(alaves.kickoff, '2026-10-31T20:00:00Z')
  const clasico = snapshot.fixtures.find((fixture) => fixture.homeCode === 'BAR' && fixture.awayCode === 'RMA')
  assert.equal(clasico.kickoff, '2026-10-25T20:00:00Z', 'Kickoff uses CET after the October clock change')
  for (const fixture of snapshot.fixtures.filter((fixture) => fixture.competition === 'La Liga' && fixture.date > '2026-10-31')) {
    assert.equal(fixture.kickoff, null)
    assert.equal(fixture.confirmed, false)
  }
})
