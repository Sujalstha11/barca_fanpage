import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { players as localPlayers } from '../src/data/players.js'
import { createApiFootballClient } from './football-data/api-client.mjs'
import {
  FINISHED_STATUSES,
  competitionMetadata,
  createRuntimeConfig,
  isCompetitiveCompetition,
} from './football-data/config.mjs'
import {
  aggregatePlayerStats,
  fixtureToSnapshotEntries,
  hasCanonicalChanges,
  mapGoalEvents,
  mapProviderPlayers,
  normalizeName,
  normalizeStandings,
  shouldRunScheduled,
  teamCodeFor,
  validateSnapshot,
} from './football-data/model.mjs'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')
const SNAPSHOT_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'generated', 'snapshot.json')

function parseArguments(argumentsList) {
  const options = { mode: 'full', dryRun: false, now: new Date() }

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--mode') {
      options.mode = argumentsList[index + 1]
      index += 1
      continue
    }
    if (argument === '--now') {
      options.now = new Date(argumentsList[index + 1])
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  if (!['full', 'scheduled'].includes(options.mode)) {
    throw new Error('--mode must be either "full" or "scheduled".')
  }
  if (Number.isNaN(options.now.getTime())) throw new Error('--now must be a valid date/time.')
  return options
}

async function loadLocalEnvironment() {
  const environmentPath = path.join(PROJECT_ROOT, '.env')
  if (!existsSync(environmentPath) || process.env.API_FOOTBALL_KEY) return
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('This Node.js version cannot load .env files. Use Node.js 20.12 or newer.')
  }
  process.loadEnvFile(environmentPath)
}

async function readSnapshot() {
  return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))
}

async function writeSnapshotAtomically(snapshot) {
  const temporaryPath = `${SNAPSHOT_PATH}.tmp-${process.pid}-${Date.now()}`
  const contents = `${JSON.stringify(snapshot, null, 2)}\n`
  await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
  await rename(temporaryPath, SNAPSHOT_PATH)
}

function seasonLabel(season) {
  return `${season}/${String(season + 1).slice(-2)}`
}

function coverageForSeason(leagueRow, season) {
  const seasonRow = leagueRow.seasons?.find((entry) => Number(entry.year) === Number(season))
  return seasonRow?.coverage || {}
}

function competitionFromLeagueRow(leagueRow, season) {
  const league = leagueRow.league || {}
  const metadata = competitionMetadata(league)
  const coverage = coverageForSeason(leagueRow, season)

  return {
    providerLeagueId: Number(league.id),
    id: metadata.id,
    name: metadata.name,
    type: league.type || 'Competition',
    season: seasonLabel(season),
    hasStandings: Boolean(coverage.standings),
    hasEvents: coverage.fixtures?.events !== false,
    hasPlayerStats: coverage.players !== false && coverage.fixtures?.statistics_players !== false,
    totalMatchdays: metadata.totalMatchdays,
    sourceLabel: metadata.sourceLabel,
    sourceUrl: metadata.sourceUrl,
  }
}

async function verifyTeam(client, runtimeConfig, existingSource, checkedAt) {
  if (
    existingSource?.teamVerified === true
    && Number(existingSource.teamId) === runtimeConfig.teamId
    && existingSource.teamName === runtimeConfig.teamName
    && existingSource.teamCountry === runtimeConfig.teamCountry
  ) {
    return {
      teamVerified: true,
      teamVerifiedAt: existingSource.teamVerifiedAt,
      teamName: existingSource.teamName,
      teamCountry: existingSource.teamCountry,
    }
  }

  const body = await client.get('teams', { id: runtimeConfig.teamId })
  const row = body.response.find((entry) => Number(entry.team?.id) === runtimeConfig.teamId)
  if (!row?.team) throw new Error(`Team ${runtimeConfig.teamId} was not returned by API-Football.`)

  const nameMatches = normalizeName(row.team.name) === normalizeName(runtimeConfig.teamName)
  const countryMatches = normalizeName(row.team.country) === normalizeName(runtimeConfig.teamCountry)
  if (!nameMatches || row.team.national || !countryMatches) {
    throw new Error(
      `Team ID ${runtimeConfig.teamId} resolved to ${row.team.name || 'unknown'} (${row.team.country || 'unknown'}), not the configured club.`,
    )
  }

  return {
    teamVerified: true,
    teamVerifiedAt: checkedAt,
    teamName: row.team.name,
    teamCountry: row.team.country,
  }
}

async function discoverCompetitions(client, runtimeConfig) {
  const body = await client.get('leagues', {
    team: runtimeConfig.teamId,
    season: runtimeConfig.season,
  })

  const competitions = body.response
    .filter((row) => row?.league?.id && isCompetitiveCompetition(row.league))
    .map((row) => competitionFromLeagueRow(row, runtimeConfig.season))
    .filter((competition) => Number.isInteger(competition.providerLeagueId))
    .sort((left, right) => left.providerLeagueId - right.providerLeagueId)

  if (competitions.length === 0) {
    throw new Error(`API-Football returned no competitive competitions for season ${runtimeConfig.season}.`)
  }
  return competitions
}

function existingCompetitions(snapshot, runtimeConfig) {
  if (Number(snapshot.source?.season) !== runtimeConfig.season) return null
  const competitions = snapshot.source?.competitions
  if (!Array.isArray(competitions) || competitions.length === 0) return null
  if (competitions.some((competition) => !Number.isInteger(Number(competition.providerLeagueId)))) return null
  return competitions
}

function fixtureIdentity(apiFixture) {
  return [
    String(apiFixture.fixture?.date || '').slice(0, 10),
    teamCodeFor(apiFixture.teams?.home),
    teamCodeFor(apiFixture.teams?.away),
  ].join('|')
}

function snapshotIdentity(entry) {
  return [
    entry.date,
    teamCodeFor({ name: entry.home, code: entry.homeCode }),
    teamCodeFor({ name: entry.away, code: entry.awayCode }),
  ].join('|')
}

function findExistingEntry(apiFixture, entries) {
  const providerId = Number(apiFixture.fixture?.id)
  return entries.find((entry) => Number(entry.providerId) === providerId)
    || entries.find((entry) => snapshotIdentity(entry) === fixtureIdentity(apiFixture))
}

function scoreChanged(apiFixture, existing) {
  if (!existing) return true
  return Number(apiFixture.goals?.home) !== Number(existing.homeScore)
    || Number(apiFixture.goals?.away) !== Number(existing.awayScore)
    || apiFixture.fixture?.status?.short !== existing.status
    || !existing.providerId
}

function chunks(values, maximumSize) {
  const result = []
  for (let index = 0; index < values.length; index += maximumSize) {
    result.push(values.slice(index, index + maximumSize))
  }
  return result
}

async function loadFixtureDetails(client, fixtures, competitionByLeagueId) {
  if (fixtures.length === 0) return new Map()
  const details = new Map()

  for (const batch of chunks(fixtures, 20)) {
    const ids = batch.map((fixture) => fixture.fixture.id).join('-')
    const body = await client.get('fixtures', { ids })
    for (const fixture of body.response) details.set(Number(fixture.fixture?.id), fixture)
  }

  for (const fixture of fixtures) {
    const fixtureId = Number(fixture.fixture?.id)
    const detail = details.get(fixtureId) || fixture
    const expectedGoals = Number(fixture.goals?.home || 0) + Number(fixture.goals?.away || 0)
    const competition = competitionByLeagueId.get(Number(fixture.league?.id))
    const availableGoals = mapGoalEvents(detail.events).length
    if (expectedGoals === 0 || availableGoals >= expectedGoals || competition?.hasEvents === false) {
      details.set(fixtureId, detail)
      continue
    }

    const eventBody = await client.get('fixtures/events', { fixture: fixtureId })
    if (mapGoalEvents(eventBody.response).length < expectedGoals) {
      throw new Error(`Goal events for completed fixture ${fixtureId} are not available yet.`)
    }
    details.set(fixtureId, { ...detail, events: eventBody.response })
  }

  return details
}

function mergeFixtureDetails(fixtures, details) {
  return fixtures.map((fixture) => details.get(Number(fixture.fixture?.id)) || fixture)
}

function assertCompleteSeasonResponse(apiFixtures, snapshot, runtimeConfig) {
  const finished = apiFixtures.filter((fixture) => FINISHED_STATUSES.has(fixture.fixture?.status?.short))
  const invalidFinished = finished.find((fixture) => (
    !Number.isInteger(Number(fixture.fixture?.id))
    || !Number.isInteger(fixture.goals?.home)
    || fixture.goals.home < 0
    || !Number.isInteger(fixture.goals?.away)
    || fixture.goals.away < 0
  ))
  if (invalidFinished) {
    throw new Error(`Completed fixture ${invalidFinished.fixture?.id || 'unknown'} has incomplete score data.`)
  }
  const invalidShootout = finished.find((fixture) => {
    if (fixture.fixture?.status?.short !== 'PEN') return false
    const home = fixture.score?.penalty?.home
    const away = fixture.score?.penalty?.away
    return !Number.isInteger(home) || home < 0 || !Number.isInteger(away) || away < 0 || home === away
  })
  if (invalidShootout) {
    throw new Error(`Fixture ${invalidShootout.fixture?.id || 'unknown'} is final after penalties but has no decisive shootout score.`)
  }
  const wrongTeam = apiFixtures.find((fixture) => (
    Number(fixture.teams?.home?.id) !== runtimeConfig.teamId
    && Number(fixture.teams?.away?.id) !== runtimeConfig.teamId
  ))
  if (wrongTeam) throw new Error(`Fixture ${wrongTeam.fixture?.id} does not include the configured team.`)

  const sameSeason = Number(snapshot.source?.season) === runtimeConfig.season
  const hasProviderBaseline = snapshot.source?.name === 'api-football'
    && sameSeason
    && Number(snapshot.source?.teamId) === runtimeConfig.teamId

  if (!hasProviderBaseline) {
    if (apiFixtures.length < Math.min(10, snapshot.results.length + snapshot.fixtures.length)) {
      throw new Error(`The first API import returned only ${apiFixtures.length} season fixtures; the manual snapshot was preserved.`)
    }
    if (sameSeason && snapshot.results.length > 0 && finished.length === 0) {
      throw new Error('The first API import returned no completed matches for the current season.')
    }
    return
  }

  if (finished.length < snapshot.results.length) {
    throw new Error(
      `API-Football returned only ${finished.length} completed matches; the current snapshot has ${snapshot.results.length}.`,
    )
  }

  const unmatched = snapshot.results.filter((result) => !apiFixtures.some((fixture) => {
    if (Number(result.providerId) === Number(fixture.fixture?.id) && result.providerId) return true
    return snapshotIdentity(result) === fixtureIdentity(fixture)
  }))
  if (unmatched.length > 0) {
    throw new Error(`Season response omitted existing match data: ${unmatched.map((match) => match.id).join(', ')}.`)
  }

  const providerFixtureIds = new Set(apiFixtures.map((fixture) => Number(fixture.fixture?.id)))
  const unmatchedScheduledFixtures = snapshot.fixtures.filter((fixture) => (
    fixture.providerId
      ? !providerFixtureIds.has(Number(fixture.providerId))
      : !apiFixtures.some((candidate) => snapshotIdentity(fixture) === fixtureIdentity(candidate))
  ))
  if (unmatchedScheduledFixtures.length > 0) {
    throw new Error(
      `Season response omitted scheduled fixture data: ${unmatchedScheduledFixtures.map((fixture) => fixture.id).join(', ')}.`,
    )
  }
}

function assertFreshStandings(standings, results, competitions) {
  for (const standing of standings) {
    const competition = competitions.find(
      (entry) => Number(entry.providerLeagueId) === Number(standing.providerLeagueId),
    )
    const competitionResults = results.filter(
      (result) => Number(result.providerLeagueId) === Number(standing.providerLeagueId),
    )
    const tablePhaseMatches = Number.isInteger(competition?.totalMatchdays)
      ? competitionResults.filter((result) => /matchday/i.test(result.round)).length
      : competitionResults.length
    const expectedPlayed = Number.isInteger(competition?.totalMatchdays)
      ? Math.min(tablePhaseMatches, competition.totalMatchdays)
      : tablePhaseMatches
    if (standing.played < expectedPlayed) {
      throw new Error(
        `${standing.competition} standings are stale (${standing.played} played, ${expectedPlayed} table-phase fixtures).`,
      )
    }
  }
}

function assertFreshPlayerStats(playerStats, results, competitions) {
  const coveredLeagues = new Set(competitions
    .filter((competition) => competition.hasPlayerStats)
    .map((competition) => Number(competition.providerLeagueId)))
  const expected = new Map()

  function addContribution(playerId, key) {
    if (playerId === null || playerId === undefined) return
    const identity = String(playerId)
    const contribution = expected.get(identity) || { goals: 0, assists: 0 }
    contribution[key] += 1
    expected.set(identity, contribution)
  }

  for (const result of results) {
    if (!coveredLeagues.has(Number(result.providerLeagueId)) || result.status === 'PEN') continue
    for (const goal of result.goals || []) {
      if (goal.teamCode !== 'BAR' || goal.type === 'own-goal') continue
      addContribution(goal.scorerId, 'goals')
      addContribution(goal.assistId, 'assists')
    }
  }

  const statsByPlayer = new Map(playerStats.map((stat) => [String(stat.playerId), stat]))
  for (const [playerId, contribution] of expected) {
    const statistics = statsByPlayer.get(playerId)
    if (!statistics || statistics.goals < contribution.goals || statistics.assists < contribution.assists) {
      throw new Error(`Player statistics are not caught up for ${playerId}; the current snapshot was preserved.`)
    }
  }
}

function reportRequestCount(client) {
  const rateLimit = client.getRateLimit()
  const quota = rateLimit.remaining ? `; daily quota remaining: ${rateLimit.remaining}` : ''
  console.log(`API requests used: ${client.getRequestCount()}${quota}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  await loadLocalEnvironment()
  const runtimeConfig = createRuntimeConfig(process.env)
  const snapshot = await readSnapshot()
  validateSnapshot(snapshot)
  const sameSeason = Number(snapshot.source?.season) === runtimeConfig.season

  if (options.mode === 'scheduled' && !sameSeason) {
    console.log('The configured season changed; run a full update to initialize the new season.')
    return
  }

  if (options.mode === 'scheduled' && !shouldRunScheduled(snapshot, options.now, runtimeConfig)) {
    console.log('No fixture is inside the post-match update window; no API request was made.')
    return
  }

  if (!runtimeConfig.apiKey) {
    throw new Error('Set API_FOOTBALL_KEY in .env locally or as a GitHub Actions secret.')
  }

  const client = createApiFootballClient({
    apiKey: runtimeConfig.apiKey,
    baseUrl: runtimeConfig.baseUrl,
  })
  const checkedAt = options.now.toISOString()
  const previousResults = sameSeason ? snapshot.results : []
  const previousFixtures = sameSeason ? snapshot.fixtures : []
  const previousPlayerStats = sameSeason ? snapshot.playerStats : []

  const teamVerification = await verifyTeam(client, runtimeConfig, snapshot.source, checkedAt)
  const savedCompetitions = existingCompetitions(snapshot, runtimeConfig)
  const competitions = options.mode === 'scheduled' && savedCompetitions
    ? savedCompetitions
    : await discoverCompetitions(client, runtimeConfig)
  const competitionByLeagueId = new Map(
    competitions.map((competition) => [Number(competition.providerLeagueId), competition]),
  )

  const fixtureBody = await client.get('fixtures', {
    team: runtimeConfig.teamId,
    season: runtimeConfig.season,
  })
  const apiFixtures = fixtureBody.response.filter(
    (fixture) => competitionByLeagueId.has(Number(fixture.league?.id)),
  )
  if (apiFixtures.length === 0) throw new Error('API-Football returned no season fixtures for the selected competitions.')
  assertCompleteSeasonResponse(apiFixtures, snapshot, runtimeConfig)

  const changedFinishedFixtures = apiFixtures.filter((fixture) => {
    if (!FINISHED_STATUSES.has(fixture.fixture?.status?.short)) return false
    return scoreChanged(fixture, findExistingEntry(fixture, previousResults))
  })

  if (options.mode === 'scheduled' && changedFinishedFixtures.length === 0) {
    console.log('The monitored match is not final yet, or it was already imported. Nothing changed.')
    reportRequestCount(client)
    return
  }

  const recentFinishedFixtures = options.mode === 'full'
    ? apiFixtures
        .filter((fixture) => FINISHED_STATUSES.has(fixture.fixture?.status?.short))
        .sort((left, right) => Date.parse(right.fixture?.date) - Date.parse(left.fixture?.date))
        .slice(0, 3)
    : []
  const detailFixtures = [...new Map(
    [...changedFinishedFixtures, ...recentFinishedFixtures]
      .map((fixture) => [Number(fixture.fixture?.id), fixture]),
  ).values()]

  const providerRows = await client.getAll('players', {
    team: runtimeConfig.teamId,
    season: runtimeConfig.season,
  })
  if (providerRows.length === 0 && previousPlayerStats.length > 0) {
    throw new Error('API-Football returned an empty player feed; the current player statistics were preserved.')
  }

  const playerMapping = mapProviderPlayers(
    providerRows,
    localPlayers,
    snapshot.providerMappings?.players || {},
  )
  const playerStats = aggregatePlayerStats(providerRows, {
    teamId: runtimeConfig.teamId,
    leagueIds: new Set(competitions.map((competition) => Number(competition.providerLeagueId))),
    resolvePlayerId: playerMapping.resolvePlayerId,
  })
  if (playerStats.length === 0 && previousPlayerStats.length > 0) {
    throw new Error('No usable player statistics were returned; the current snapshot was preserved.')
  }

  const details = await loadFixtureDetails(client, detailFixtures, competitionByLeagueId)
  const fixturesWithDetails = mergeFixtureDetails(apiFixtures, details)
  const normalizedMatches = fixtureToSnapshotEntries(fixturesWithDetails, {
    teamId: runtimeConfig.teamId,
    competitionByLeagueId,
    existingResults: previousResults,
    existingFixtures: previousFixtures,
    resolvePlayerId: playerMapping.resolvePlayerId,
  })

  const standings = []
  for (const competition of competitions.filter((entry) => entry.hasStandings)) {
    const body = await client.get('standings', {
      league: competition.providerLeagueId,
      season: runtimeConfig.season,
    })
    const standing = normalizeStandings(body.response, {
      teamId: runtimeConfig.teamId,
      competition,
    })
    if (!standing) {
      const competitionHasResults = normalizedMatches.results.some(
        (result) => Number(result.providerLeagueId) === Number(competition.providerLeagueId),
      )
      if (competitionHasResults) throw new Error(`${competition.name} standings did not contain Barcelona.`)
      continue
    }
    standings.push(standing)
  }

  assertFreshStandings(standings, normalizedMatches.results, competitions)
  assertFreshPlayerStats(playerStats, normalizedMatches.results, competitions)

  const candidate = {
    schemaVersion: 1,
    generatedAt: checkedAt,
    source: {
      name: 'api-football',
      teamId: runtimeConfig.teamId,
      season: runtimeConfig.season,
      ...teamVerification,
      competitions,
      lastSuccessfulSync: checkedAt,
      requestsUsed: client.getRequestCount(),
    },
    providerMappings: {
      ...(snapshot.providerMappings || {}),
      players: playerMapping.mappings,
    },
    providerPlayers: playerMapping.providerPlayers,
    results: normalizedMatches.results,
    fixtures: normalizedMatches.fixtures,
    playerStats,
    standings,
  }

  validateSnapshot(candidate)
  if (!hasCanonicalChanges(snapshot, candidate)) {
    console.log('API data matches the current snapshot; no file was written.')
    reportRequestCount(client)
    return
  }

  if (options.dryRun) {
    console.log('Validated API changes successfully (dry run); no file was written.')
  } else {
    await writeSnapshotAtomically(candidate)
    console.log(`Updated ${path.relative(PROJECT_ROOT, SNAPSHOT_PATH)} safely.`)
  }
  reportRequestCount(client)
}

export { assertCompleteSeasonResponse, assertFreshPlayerStats, assertFreshStandings }

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Football data update failed: ${error.message}`)
    process.exitCode = 1
  })
}
