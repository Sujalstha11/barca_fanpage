import snapshot, { snapshotCheckedAt } from './snapshot.js'

function fixtureTime(fixture) {
  const value = fixture.kickoff || (fixture.date ? `${fixture.date}T12:00:00Z` : '')
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

export const fixtures = (Array.isArray(snapshot.fixtures) ? snapshot.fixtures : [])
  .map((fixture) => ({ ...fixture }))
  .sort((first, second) => fixtureTime(first) - fixtureTime(second))

export const fixtureCompetitions = ['All', ...new Set(fixtures.map((fixture) => fixture.competition).filter(Boolean))]
export const fixturesCheckedAt = snapshotCheckedAt

export const getTeamSide = (fixture) => (fixture.homeCode === 'BAR' ? 'home' : 'away')
