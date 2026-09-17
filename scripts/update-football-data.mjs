import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { players as localPlayers } from '../src/data/players.js'
import { createApiFootballClient } from './football-data/api-client.mjs'
import { GoalApiError, createGoalApiClient } from './football-data/goal-api-client.mjs'
import {
  adaptBarcaStandings,
  adaptGoalFixture,
  adaptGoalPlayers,
  adaptGoalStandings,
  goalSeasonLabel,
  positiveNumericId,
} from './football-data/goal-api-adapter.mjs'
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
const MAX_GOAL_SQUAD_PLAYERS = 60
const GOAL_PERFORMANCE_FIELDS = ['matchPlayed', 'minutes', 'goals', 'assists']

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
  if (!existsSync(environmentPath)) return
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
    existingSource?.name === 'api-football'
    && existingSource?.teamVerified === true
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
  if (snapshot.source?.name !== 'api-football') return null
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
  const providerName = runtimeConfig.providerName || 'api-football'
  const providerLabel = runtimeConfig.providerLabel || 'The football data provider'
  const hasProviderBaseline = snapshot.source?.name === providerName
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
      `${providerLabel} returned only ${finished.length} completed matches; the current snapshot has ${snapshot.results.length}.`,
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
      const actual = statistics
        ? `${statistics.goals} goals/${statistics.assists} assists`
        : 'no statistics row'
      throw new Error(
        `Player statistics are not caught up for ${playerId} (${actual}; expected at least ${contribution.goals} goals/${contribution.assists} assists); the current snapshot was preserved.`,
      )
    }
  }
}

function reportRequestCount(client) {
  const rateLimit = client.getRateLimit()
  const quota = rateLimit.remaining ? `; daily quota remaining: ${rateLimit.remaining}` : ''
  console.log(`API requests used: ${client.getRequestCount()}${quota}`)
}

function normalizedClubName(value) {
  return normalizeName(value)
    .replace(/^(?:fc|cf)\s+/, '')
    .replace(/\s+(?:fc|cf)$/, '')
}

function goalFixtureBelongsToSeason(fixture, season) {
  const value = String(fixture?.leagueYear || '').trim()
  if (!value) return true
  const normalized = value.replace(/-/g, '/').replace(/\s+/g, '')
  const accepted = new Set([
    String(season),
    `${season}/${season + 1}`,
    `${season}/${String(season + 1).slice(-2)}`,
  ])
  return accepted.has(normalized)
}

function goalSeasonRange(season) {
  return {
    from: `${season}-07-01`,
    to: `${season + 1}-06-30`,
  }
}

function goalFixtureLeagueKey(fixture) {
  return String(fixture?.leagueId || fixture?.league?.id || '').trim()
}

function goalFixtureKey(fixture) {
  return String(fixture?.id || fixture?.apiId || '').trim()
}

async function resolveGoalTeam(client, runtimeConfig, snapshot, options) {
  if (
    options.mode === 'scheduled'
    && snapshot.source?.name === 'goal-api'
    && snapshot.source?.teamProviderId
    && Number.isInteger(Number(snapshot.source?.teamId))
  ) {
    return {
      id: snapshot.source.teamProviderId,
      apiId: String(snapshot.source.teamId),
      name: snapshot.source.teamName || runtimeConfig.teamName,
      country: snapshot.source.teamCountry || runtimeConfig.teamCountry,
    }
  }

  const rows = await client.getAll('teams', {
    search: runtimeConfig.teamName,
    country: runtimeConfig.teamCountry,
    isActive: true,
  })
  const expectedName = normalizedClubName(runtimeConfig.teamName)
  const expectedCountry = normalizeName(runtimeConfig.teamCountry)
  let matches = rows.filter((team) => (
    normalizedClubName(team?.name) === expectedName
    && normalizeName(team?.country) === expectedCountry
  ))
  if (runtimeConfig.goalTeamApiId) {
    matches = matches.filter((team) => Number(team?.apiId) === runtimeConfig.goalTeamApiId)
  }
  if (matches.length !== 1) {
    throw new Error(`GOAL API team discovery found ${matches.length} exact Barcelona matches; the snapshot was preserved.`)
  }
  const team = matches[0]
  if (!team.id || !Number.isInteger(Number(team.apiId)) || Number(team.apiId) <= 0) {
    throw new Error('GOAL API returned Barcelona without usable team identifiers.')
  }
  return team
}

async function discoverGoalCompetitions(client, fixtures, runtimeConfig, snapshot, options) {
  const saved = options.mode === 'scheduled' && snapshot.source?.name === 'goal-api'
    ? snapshot.source?.competitions || []
    : []
  const savedByKey = new Map(saved
    .filter((competition) => competition?.providerKey)
    .map((competition) => [String(competition.providerKey), competition]))
  const firstFixtureByLeague = new Map()
  for (const fixture of fixtures) {
    const key = goalFixtureLeagueKey(fixture)
    if (key && !firstFixtureByLeague.has(key)) firstFixtureByLeague.set(key, fixture)
  }

  const competitions = []
  for (const [providerKey, fixture] of firstFixtureByLeague) {
    const savedCompetition = savedByKey.get(providerKey)
    if (savedCompetition) {
      competitions.push(savedCompetition)
      continue
    }

    const body = await client.get(`leagues/${encodeURIComponent(providerKey)}`)
    const league = body.data || {}
    const fixtureLeagueName = fixture?.league?.name || fixture?.leagueName || league.name
    if (!isCompetitiveCompetition({ name: fixtureLeagueName })) continue
    const providerLeagueId = positiveNumericId(league.apiId || providerKey)
    const metadata = competitionMetadata({ id: providerLeagueId, name: league.name || fixtureLeagueName })
    const hasTable = ['la-liga', 'champions-league'].includes(metadata.id)
    competitions.push({
      providerLeagueId,
      providerKey,
      id: metadata.id,
      name: metadata.name,
      type: hasTable ? 'League' : 'Competition',
      season: seasonLabel(runtimeConfig.season),
      hasStandings: hasTable,
      hasEvents: true,
      hasPlayerStats: true,
      totalMatchdays: metadata.totalMatchdays,
      sourceLabel: metadata.sourceLabel,
      sourceUrl: metadata.sourceUrl,
    })
  }

  if (competitions.length === 0) {
    throw new Error(`GOAL API returned no competitive competitions for ${goalSeasonLabel(runtimeConfig.season)}.`)
  }
  return competitions.sort((left, right) => left.providerLeagueId - right.providerLeagueId)
}

function goalPlayerIndexes(players) {
  const byProviderId = new Map()
  const byProviderKey = new Map()
  const byName = new Map()
  for (const player of players) {
    const numericId = positiveNumericId(player?.apiId || player?.id)
    if (numericId) byProviderId.set(numericId, player)
    if (player?.id) byProviderKey.set(String(player.id), numericId)
    if (player?.name) byName.set(normalizeName(player.name), numericId)
  }
  return { byProviderId, byProviderKey, byName }
}

function goalPerformanceTotal(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null
  if (typeof value === 'string' && !value.trim()) return null
  const total = Number(value)
  return Number.isInteger(total) && total >= 0 ? total : null
}

async function enrichGoalPlayersWithStatistics(client, players) {
  if (!Array.isArray(players)) {
    throw new Error('GOAL API returned an invalid Barcelona player feed; the current statistics were preserved.')
  }
  if (players.length > MAX_GOAL_SQUAD_PLAYERS) {
    throw new Error(
      `GOAL API returned ${players.length} Barcelona players, above the safe per-sync limit of ${MAX_GOAL_SQUAD_PLAYERS}; the current statistics were preserved.`,
    )
  }

  const enrichedPlayers = []
  for (const player of players) {
    const playerId = String(player?.id || '').trim()
    const playerLabel = String(player?.name || playerId || 'unknown player')
    if (!playerId) {
      throw new Error(`GOAL API returned ${playerLabel} without a player id; the current statistics were preserved.`)
    }

    const body = await client.get(`players/${encodeURIComponent(playerId)}/statistics`)
    const performance = body.data?.performance
    const totals = Object.fromEntries(GOAL_PERFORMANCE_FIELDS.map((field) => [
      field,
      goalPerformanceTotal(performance?.[field]),
    ]))
    if (GOAL_PERFORMANCE_FIELDS.some((field) => totals[field] === null)) {
      throw new Error(
        `GOAL API returned incomplete performance statistics for ${playerLabel}; the current statistics were preserved.`,
      )
    }

    enrichedPlayers.push({ ...player, ...totals })
  }
  return enrichedPlayers
}

function lineupPlayerId(entry, indexes) {
  const byKey = indexes.byProviderKey.get(String(entry?.playerId || ''))
  if (byKey) return byKey
  const playerKey = Number(entry?.playerKey)
  if (Number.isInteger(playerKey) && playerKey > 0 && indexes.byProviderId.has(playerKey)) return playerKey
  return indexes.byName.get(normalizeName(entry?.lineupPlayer)) || null
}

async function loadGoalStarts(client, fixtures, team, players) {
  const starts = new Map()
  const indexes = goalPlayerIndexes(players)
  const finishedStatuses = new Set(['FINISHED', 'AFTER_ET', 'AFTER_PEN'])

  for (const fixture of fixtures.filter((entry) => finishedStatuses.has(String(entry?.matchStatus)))) {
    let body
    try {
      body = await client.get(`fixtures/${encodeURIComponent(goalFixtureKey(fixture))}/lineups`)
    } catch (error) {
      if (error instanceof GoalApiError && [403, 404].includes(error.status)) continue
      throw error
    }
    if (!body.data || body.data.hasLineups === false) continue
    const side = String(fixture?.homeTeamId) === String(team.id) ? 'home' : 'away'
    for (const entry of body.data?.[side]?.startingLineups || []) {
      const playerId = lineupPlayerId(entry, indexes)
      if (playerId) starts.set(playerId, (starts.get(playerId) || 0) + 1)
    }
  }
  return starts
}

async function loadGoalFixtureEvents(client, rawFixtures, adaptedFixtures, fixturesToLoad, adapterOptions) {
  const rawById = new Map(rawFixtures.map((fixture) => [
    positiveNumericId(fixture?.apiId || fixture?.id),
    fixture,
  ]))
  const details = new Map()
  for (const fixture of fixturesToLoad) {
    const fixtureId = Number(fixture.fixture?.id)
    const raw = rawById.get(fixtureId)
    if (!raw) throw new Error(`GOAL API fixture ${fixtureId} could not be matched for event loading.`)
    const expectedGoals = Number(fixture.goals?.home || 0) + Number(fixture.goals?.away || 0)
    let events = []
    if (expectedGoals > 0) {
      const body = await client.get(`fixtures/${encodeURIComponent(goalFixtureKey(raw))}/events`)
      events = Array.isArray(body.data) ? body.data : []
    }
    const detail = adaptGoalFixture({ ...raw, events }, adapterOptions)
    if (expectedGoals > 0 && mapGoalEvents(detail.events).length < expectedGoals) {
      throw new Error(`Goal events for completed GOAL API fixture ${fixtureId} are not available yet.`)
    }
    details.set(fixtureId, detail)
  }
  return mergeFixtureDetails(adaptedFixtures, details)
}

function mergeGoalPlayerStats(currentStats, previousStats) {
  const previousById = new Map(previousStats.map((entry) => [String(entry.playerId), entry]))
  const merged = currentStats.map((entry) => {
    const previous = previousById.get(String(entry.playerId))
    previousById.delete(String(entry.playerId))
    if (!previous) return entry
    return {
      ...entry,
      appearances: Math.max(entry.appearances, previous.appearances),
      starts: Math.min(Math.max(entry.starts, previous.starts), Math.max(entry.appearances, previous.appearances)),
      minutes: Math.max(entry.minutes, previous.minutes),
      goals: Math.max(entry.goals, previous.goals),
      assists: Math.max(entry.assists, previous.assists),
    }
  })
  return [...merged, ...previousById.values()].sort((left, right) => String(left.playerId).localeCompare(
    String(right.playerId),
    undefined,
    { numeric: true },
  ))
}

function competitionForm(results, providerLeagueId) {
  return results
    .filter((result) => Number(result.providerLeagueId) === Number(providerLeagueId))
    .slice(0, 5)
    .reverse()
    .map((result) => result.outcome)
    .filter((value) => ['W', 'D', 'L'].includes(value))
}

async function fetchBarcaStandings(runtimeConfig, competitionCode) {
  const url = new URL('/api/standings', `${runtimeConfig.barcaBaseUrl.replace(/\/$/, '')}/`)
  url.searchParams.set('competition', competitionCode)
  url.searchParams.set('season', String(runtimeConfig.season))
  let requests = 0

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      requests += 1
      const response = await fetch(url, { signal: controller.signal })
      const body = await response.json()
      if (!response.ok || !Array.isArray(body?.data)) {
        const error = new Error(`Barça API standings request failed with HTTP ${response.status}.`)
        error.status = response.status
        throw error
      }
      return { rows: body.data, requests }
    } catch (error) {
      const retryable = error?.status === undefined || error.status >= 500
      if (retryable && attempt < 2) continue
      throw new Error(`Could not load fallback Champions League standings: ${error.message}`, { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }
  return { rows: [], requests }
}

async function buildGoalCandidate({ snapshot, runtimeConfig, options, checkedAt }) {
  if (!runtimeConfig.goalApiKey) {
    throw new Error('Set GOAL_API_KEY in .env locally or as a GitHub Actions secret.')
  }
  const client = createGoalApiClient({
    apiKey: runtimeConfig.goalApiKey,
    baseUrl: runtimeConfig.goalBaseUrl,
  })
  const team = await resolveGoalTeam(client, runtimeConfig, snapshot, options)
  const teamNumericId = positiveNumericId(team.apiId)
  const range = goalSeasonRange(runtimeConfig.season)
  const rawFixtures = (await client.getAll('fixtures', {
    teamId: team.id,
    ...range,
  })).filter((fixture) => goalFixtureBelongsToSeason(fixture, runtimeConfig.season))
  if (rawFixtures.length === 0) throw new Error('GOAL API returned no Barcelona fixtures for the configured season.')

  const competitions = await discoverGoalCompetitions(client, rawFixtures, runtimeConfig, snapshot, options)
  const competitionByKey = new Map(competitions.map((competition) => [String(competition.providerKey), competition]))
  const relevantRawFixtures = rawFixtures.filter((fixture) => competitionByKey.has(goalFixtureLeagueKey(fixture)))
  const adapterOptions = {
    teamProviderId: team.id,
    teamNumericId,
    leagueByProviderId: competitionByKey,
    playerByName: new Map(),
  }
  const adaptedFixtures = relevantRawFixtures.map((fixture) => adaptGoalFixture(fixture, adapterOptions))
  const providerRuntimeConfig = {
    ...runtimeConfig,
    teamId: teamNumericId,
    providerName: 'goal-api',
    providerLabel: 'GOAL API',
  }
  assertCompleteSeasonResponse(adaptedFixtures, snapshot, providerRuntimeConfig)

  const sameSeason = Number(snapshot.source?.season) === runtimeConfig.season
  const previousResults = sameSeason ? snapshot.results : []
  const previousFixtures = sameSeason ? snapshot.fixtures : []
  const previousPlayerStats = sameSeason ? snapshot.playerStats : []
  const changedFinishedFixtures = adaptedFixtures.filter((fixture) => (
    FINISHED_STATUSES.has(fixture.fixture?.status?.short)
    && scoreChanged(fixture, findExistingEntry(fixture, previousResults))
  ))
  if (options.mode === 'scheduled' && changedFinishedFixtures.length === 0) {
    return {
      candidate: null,
      client,
      message: 'The monitored match is not final yet, or it was already imported. Nothing changed.',
      publicRequests: 0,
    }
  }

  let goalPlayers = await client.getAll(`teams/${encodeURIComponent(team.id)}/players`)
  if (goalPlayers.length === 0) goalPlayers = await client.getAll('players', { teamId: team.id })
  if (goalPlayers.length === 0 && previousPlayerStats.length > 0) {
    throw new Error('GOAL API returned an empty Barcelona player feed; the current statistics were preserved.')
  }
  goalPlayers = await enrichGoalPlayersWithStatistics(client, goalPlayers)
  const startsByProviderId = await loadGoalStarts(client, relevantRawFixtures, team, goalPlayers)
  const primaryLeagueId = competitions.find((competition) => competition.id === 'la-liga')?.providerLeagueId
    || competitions[0].providerLeagueId
  const providerRows = adaptGoalPlayers(goalPlayers, {
    teamNumericId,
    leagueNumericId: primaryLeagueId,
    startsByProviderId,
  })
  const priorMappings = snapshot.source?.name === 'goal-api'
    ? snapshot.providerMappings?.players || {}
    : {}
  const playerMapping = mapProviderPlayers(providerRows, localPlayers, priorMappings)
  const playerIndexes = goalPlayerIndexes(goalPlayers)
  const playerByName = new Map([...playerIndexes.byName].map(([name, id]) => [name, { id }]))

  const recentFinishedFixtures = options.mode === 'full'
    ? adaptedFixtures
        .filter((fixture) => FINISHED_STATUSES.has(fixture.fixture?.status?.short))
        .sort((left, right) => Date.parse(right.fixture?.date) - Date.parse(left.fixture?.date))
        .slice(0, 3)
    : []
  const detailFixtures = [...new Map(
    [...changedFinishedFixtures, ...recentFinishedFixtures]
      .map((fixture) => [Number(fixture.fixture?.id), fixture]),
  ).values()]
  const fixturesWithDetails = await loadGoalFixtureEvents(
    client,
    relevantRawFixtures,
    adaptedFixtures,
    detailFixtures,
    { ...adapterOptions, playerByName },
  )
  const competitionByLeagueId = new Map(competitions.map((competition) => [
    Number(competition.providerLeagueId),
    competition,
  ]))
  const normalizedMatches = fixtureToSnapshotEntries(fixturesWithDetails, {
    teamId: teamNumericId,
    competitionByLeagueId,
    existingResults: previousResults,
    existingFixtures: previousFixtures,
    resolvePlayerId: playerMapping.resolvePlayerId,
  })
  let playerStats = aggregatePlayerStats(providerRows, {
    teamId: teamNumericId,
    leagueIds: new Set([Number(primaryLeagueId)]),
    resolvePlayerId: playerMapping.resolvePlayerId,
  })
  playerStats = mergeGoalPlayerStats(playerStats, previousPlayerStats)
  if (playerStats.length === 0 && previousPlayerStats.length > 0) {
    throw new Error('No usable GOAL API player statistics were returned; the current snapshot was preserved.')
  }

  const standings = []
  let publicRequests = 0
  for (const competition of competitions.filter((entry) => entry.hasStandings)) {
    const form = competitionForm(normalizedMatches.results, competition.providerLeagueId)
    let normalizedResponse = null
    let standingCompetition = competition
    try {
      const body = await client.get(`standings/${encodeURIComponent(competition.providerKey)}`)
      if (Array.isArray(body.data) && body.data.length > 0) {
        normalizedResponse = adaptGoalStandings(body.data, {
          teamNumericId,
          teamProviderId: team.id,
          competition,
          form,
        })
        standingCompetition = {
          ...competition,
          sourceLabel: 'GOAL API standings',
          sourceUrl: 'https://goal-api.com/coverage',
        }
      }
    } catch (error) {
      const expectedUnavailable = competition.id === 'champions-league'
        && error instanceof GoalApiError
        && [403, 404].includes(error.status)
      if (!expectedUnavailable) throw error
    }

    if (!normalizedResponse && competition.id === 'champions-league') {
      const fallback = await fetchBarcaStandings(runtimeConfig, 'UCL')
      publicRequests += fallback.requests
      normalizedResponse = adaptBarcaStandings(fallback.rows, {
        teamNumericId,
        teamProviderId: team.id,
        competition,
        form,
      })
    }

    const standing = normalizedResponse
      ? normalizeStandings(normalizedResponse, { teamId: teamNumericId, competition: standingCompetition })
      : null
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
  const previousVerificationIsCurrent = snapshot.source?.name === 'goal-api'
    && String(snapshot.source?.teamProviderId) === String(team.id)
  return {
    client,
    publicRequests,
    candidate: {
      schemaVersion: 1,
      generatedAt: checkedAt,
      source: {
        name: 'goal-api',
        teamId: teamNumericId,
        teamProviderId: team.id,
        season: runtimeConfig.season,
        teamVerified: true,
        teamVerifiedAt: previousVerificationIsCurrent ? snapshot.source.teamVerifiedAt : checkedAt,
        teamName: team.name,
        teamCountry: team.country,
        competitions,
        lastSuccessfulSync: checkedAt,
        requestsUsed: client.getRequestCount(),
        publicRequestsUsed: publicRequests,
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
    },
  }
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

  const checkedAt = options.now.toISOString()
  if (runtimeConfig.provider === 'goal-api') {
    const result = await buildGoalCandidate({ snapshot, runtimeConfig, options, checkedAt })
    if (!result.candidate) {
      console.log(result.message)
      reportRequestCount(result.client)
      return
    }
    validateSnapshot(result.candidate)
    if (!hasCanonicalChanges(snapshot, result.candidate)) {
      console.log('GOAL API data matches the current snapshot; no file was written.')
      reportRequestCount(result.client)
      return
    }
    if (options.dryRun) {
      console.log('Validated GOAL API changes successfully (dry run); no file was written.')
    } else {
      await writeSnapshotAtomically(result.candidate)
      console.log(`Updated ${path.relative(PROJECT_ROOT, SNAPSHOT_PATH)} safely.`)
    }
    reportRequestCount(result.client)
    if (result.publicRequests > 0) {
      console.log(`Public standings fallback requests used: ${result.publicRequests}`)
    }
    return
  }

  if (!runtimeConfig.apiKey) {
    throw new Error('Set API_FOOTBALL_KEY in .env locally or as a GitHub Actions secret.')
  }

  const client = createApiFootballClient({
    apiKey: runtimeConfig.apiKey,
    baseUrl: runtimeConfig.baseUrl,
  })
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

  const priorMappings = snapshot.source?.name === 'api-football'
    ? snapshot.providerMappings?.players || {}
    : {}
  const playerMapping = mapProviderPlayers(
    providerRows,
    localPlayers,
    priorMappings,
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

export {
  assertCompleteSeasonResponse,
  assertFreshPlayerStats,
  assertFreshStandings,
  enrichGoalPlayersWithStatistics,
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Football data update failed: ${error.message}`)
    process.exitCode = 1
  })
}
