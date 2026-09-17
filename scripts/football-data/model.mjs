import {
  CANCELLED_STATUSES,
  FINISHED_STATUSES,
  TEAM_CODE_ALIASES,
  competitionMetadata,
  isCompetitiveCompetition,
} from './config.mjs'

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT'])
const UNCONFIRMED_STATUSES = new Set(['TBD', 'PST', ...CANCELLED_STATUSES])
const GOAL_TYPES = new Set(['goal', 'penalty', 'own-goal', 'free-kick'])
const VOLATILE_SOURCE_KEYS = new Set([
  'checkedAt',
  'lastSuccessfulSync',
  'rateLimit',
  'requestsUsed',
  'teamVerifiedAt',
])

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.response)) return value.response
  return []
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function playerReference(value) {
  const integer = integerOrNull(value)
  if (integer !== null && integer > 0) return integer
  const text = String(value ?? '')
  return /^api-\d+$/.test(text) ? text : null
}

function nonNegativeInteger(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0
}

function textOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[ðÐđĐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedAliasEntries(aliases) {
  if (aliases instanceof Map) return [...aliases.entries()]
  if (aliases && typeof aliases === 'object') return Object.entries(aliases)
  return []
}

export function teamCodeFor(team, aliases = TEAM_CODE_ALIASES) {
  const name = typeof team === 'string' ? team : team?.name
  const normalized = normalizeName(name)
  const alias = normalizedAliasEntries(aliases)
    .find(([candidate]) => normalizeName(candidate) === normalized)?.[1]
  if (alias) return String(alias).toUpperCase()

  const providerCode = String(typeof team === 'object' ? team?.code ?? '' : '').trim().toUpperCase()
  if (/^[A-Z0-9]{2,4}$/.test(providerCode)) return providerCode

  const ignored = new Set(['afc', 'cf', 'club', 'de', 'fc', 'fk', 'real', 'sc', 'sk', 'the', 'ud'])
  const words = normalized.split(' ').filter((word) => word && !ignored.has(word))
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase()
  if (words.length === 2) return `${words[0].slice(0, 2)}${words[1][0]}`.toUpperCase()
  return (words[0] || normalized || 'TBD').slice(0, 3).padEnd(3, 'X').toUpperCase()
}

export function parseEventMinute(value) {
  const source = value?.time ?? value
  if (source && typeof source === 'object') {
    const elapsed = integerOrNull(source.elapsed ?? source.minute)
    const extra = integerOrNull(source.extra ?? source.added)
    if (elapsed === null || elapsed < 0) return null
    return { elapsed, extra: extra !== null && extra > 0 ? extra : 0 }
  }

  if (typeof source === 'number') {
    return Number.isInteger(source) && source >= 0 ? { elapsed: source, extra: 0 } : null
  }

  const match = String(source ?? '').trim().match(/^(\d+)(?:\s*\+\s*(\d+))?(?:')?$/)
  if (!match) return null
  return { elapsed: Number(match[1]), extra: Number(match[2] || 0) }
}

export const parseMinute = parseEventMinute

export function formatEventMinute(value) {
  const minute = parseEventMinute(value)
  if (!minute) return null
  return minute.extra > 0 ? `${minute.elapsed}+${minute.extra}` : String(minute.elapsed)
}

function minuteSortValue(value) {
  const minute = parseEventMinute(value)
  return minute ? (minute.elapsed * 1000) + minute.extra : Number.MAX_SAFE_INTEGER
}

function resolveMappedPlayer(resolvePlayerId, player) {
  if (typeof resolvePlayerId !== 'function' || !player) return null
  return playerReference(resolvePlayerId(player))
}

function ownGoalBeneficiary(eventTeam, fixtureTeams) {
  const eventId = integerOrNull(eventTeam?.id)
  const homeId = integerOrNull(fixtureTeams?.home?.id)
  const awayId = integerOrNull(fixtureTeams?.away?.id)
  if (eventId !== null && eventId === homeId) return fixtureTeams.away
  if (eventId !== null && eventId === awayId) return fixtureTeams.home

  const eventCode = teamCodeFor(eventTeam)
  if (eventCode === teamCodeFor(fixtureTeams?.home)) return fixtureTeams.away
  if (eventCode === teamCodeFor(fixtureTeams?.away)) return fixtureTeams.home
  return eventTeam
}

export function mapGoalEvent(event, { resolvePlayerId, teamAliases, fixtureTeams } = {}) {
  if (normalizeName(event?.type) !== 'goal') return null
  const detail = normalizeName(event?.detail)
  const comments = normalizeName(event?.comments ?? event?.comment)
  if (detail.includes('missed penalty') || detail.includes('penalty shootout') || comments.includes('penalty shootout')) {
    return null
  }

  let type = 'goal'
  if (detail.includes('own goal')) type = 'own-goal'
  else if (detail.includes('penalty')) type = 'penalty'
  else if (detail.includes('free kick')) type = 'free-kick'

  const minute = formatEventMinute(event)
  const scorer = textOrNull(event?.player?.name) || 'Unknown scorer'
  const assist = textOrNull(event?.assist?.name)
  const creditedTeam = type === 'own-goal' && fixtureTeams
    ? ownGoalBeneficiary(event?.team, fixtureTeams)
    : event?.team

  return {
    teamCode: teamCodeFor(creditedTeam, teamAliases),
    minute: minute || '0',
    scorer,
    scorerId: resolveMappedPlayer(resolvePlayerId, event?.player),
    assist,
    assistId: assist ? resolveMappedPlayer(resolvePlayerId, event?.assist) : null,
    type,
  }
}

export const mapEvent = mapGoalEvent

export function mapGoalEvents(events, options = {}) {
  return asArray(events)
    .map((event) => mapGoalEvent(event, options))
    .filter(Boolean)
    .sort((left, right) => minuteSortValue(left.minute) - minuteSortValue(right.minute))
}

export function fixtureOutcome(fixture, teamId) {
  const configuredTeamId = Number(teamId)
  const homeId = Number(fixture?.teams?.home?.id)
  const awayId = Number(fixture?.teams?.away?.id)
  if (homeId !== configuredTeamId && awayId !== configuredTeamId) return null

  if (fixture?.fixture?.status?.short === 'PEN') {
    const homePenalties = integerOrNull(fixture?.score?.penalty?.home)
    const awayPenalties = integerOrNull(fixture?.score?.penalty?.away)
    if (homePenalties !== null && awayPenalties !== null && homePenalties !== awayPenalties) {
      const homeWon = homePenalties > awayPenalties
      return (homeWon && homeId === configuredTeamId) || (!homeWon && awayId === configuredTeamId)
        ? 'win'
        : 'loss'
    }
  }

  if (fixture?.teams?.home?.winner === true || fixture?.teams?.away?.winner === true) {
    const configuredTeamWon = (fixture.teams.home.winner === true && homeId === configuredTeamId)
      || (fixture.teams.away.winner === true && awayId === configuredTeamId)
    return configuredTeamWon ? 'win' : 'loss'
  }

  const homeScore = integerOrNull(fixture?.goals?.home)
  const awayScore = integerOrNull(fixture?.goals?.away)
  if (homeScore === null || awayScore === null) return null
  if (homeScore === awayScore) return 'draw'
  const homeWon = homeScore > awayScore
  return (homeWon && homeId === configuredTeamId) || (!homeWon && awayId === configuredTeamId)
    ? 'win'
    : 'loss'
}

export const matchOutcome = fixtureOutcome

function getCompetition(league, competitionByLeagueId) {
  const leagueId = Number(league?.id)
  const supplied = competitionByLeagueId instanceof Map
    ? competitionByLeagueId.get(leagueId)
    : competitionByLeagueId?.[leagueId] ?? competitionByLeagueId?.[String(leagueId)]
  if (supplied) return supplied
  return competitionMetadata(league || {})
}

function datePart(value) {
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] || null
}

function normalizeRound(round, competition) {
  const original = textOrNull(round) || 'To be confirmed'
  const matchday = original.match(/(?:regular season|league (?:phase|stage)|matchday)\s*-?\s*(\d+)/i)
    || original.match(/-\s*(\d+)\s*$/)
  if (!matchday) return original
  const number = Number(matchday[1])
  return normalizeName(competition?.name).includes('champions league')
    ? `League phase · Matchday ${number}`
    : `Matchday ${number}`
}

function priorEntryFor(fixture, existingEntries) {
  const providerId = integerOrNull(fixture?.fixture?.id)
  if (providerId !== null) {
    const providerMatch = existingEntries.find((entry) => integerOrNull(entry?.providerId) === providerId)
    if (providerMatch) return providerMatch
  }

  const date = datePart(fixture?.fixture?.date)
  const homeCode = teamCodeFor(fixture?.teams?.home)
  const awayCode = teamCodeFor(fixture?.teams?.away)
  return existingEntries.find((entry) => (
    entry?.date === date
    && teamCodeFor({ name: entry?.home, code: entry?.homeCode }) === homeCode
    && teamCodeFor({ name: entry?.away, code: entry?.awayCode }) === awayCode
  ))
}

function slug(value) {
  return normalizeName(value).replace(/\s+/g, '-') || 'match'
}

function matchIdFor(fixture, prior, reservedIds) {
  if (textOrNull(prior?.id)) return prior.id
  const date = datePart(fixture?.fixture?.date) || 'date-tbd'
  const home = slug(fixture?.teams?.home?.name)
  const away = slug(fixture?.teams?.away?.name)
  const base = `${home}-${away}-${date}`
  if (!reservedIds.has(base)) return base
  const providerId = integerOrNull(fixture?.fixture?.id)
  return providerId === null ? `${base}-${reservedIds.size + 1}` : `${base}-${providerId}`
}

function fixtureTimestamp(fixture) {
  const timestamp = Number(fixture?.fixture?.timestamp)
  if (Number.isFinite(timestamp) && timestamp > 0) return timestamp * 1000
  const parsed = Date.parse(fixture?.fixture?.date)
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function matchBase(fixture, competition, prior, id) {
  const status = textOrNull(fixture?.fixture?.status?.short) || textOrNull(prior?.status) || 'TBD'
  const providerId = integerOrNull(fixture?.fixture?.id) ?? integerOrNull(prior?.providerId)
  const providerLeagueId = integerOrNull(fixture?.league?.id) ?? integerOrNull(prior?.providerLeagueId)
  const date = datePart(fixture?.fixture?.date) || prior?.date
  const home = textOrNull(fixture?.teams?.home?.name) || prior?.home || 'TBD'
  const away = textOrNull(fixture?.teams?.away?.name) || prior?.away || 'TBD'

  return {
    providerId,
    ...(providerLeagueId === null ? {} : { providerLeagueId }),
    status,
    id,
    date,
    home,
    homeCode: teamCodeFor(fixture?.teams?.home || { name: home, code: prior?.homeCode }),
    away,
    awayCode: teamCodeFor(fixture?.teams?.away || { name: away, code: prior?.awayCode }),
    venue: textOrNull(fixture?.fixture?.venue?.name) || prior?.venue || 'Venue TBC',
    competition: competition?.name || prior?.competition || 'Competition',
    round: normalizeRound(fixture?.league?.round || prior?.round, competition),
  }
}

export function fixtureToSnapshotEntries(apiFixtures, {
  teamId,
  competitionByLeagueId = new Map(),
  existingResults = [],
  existingFixtures = [],
  resolvePlayerId,
} = {}) {
  const previous = [...asArray(existingResults), ...asArray(existingFixtures)]
  const reservedIds = new Set(previous.map((entry) => entry?.id).filter(Boolean))
  const results = []
  const fixtures = []

  for (const fixture of asArray(apiFixtures)) {
    const homeId = Number(fixture?.teams?.home?.id)
    const awayId = Number(fixture?.teams?.away?.id)
    if (Number.isFinite(Number(teamId)) && homeId !== Number(teamId) && awayId !== Number(teamId)) continue
    if (!isCompetitiveCompetition(fixture?.league || {})) continue

    const competition = getCompetition(fixture?.league, competitionByLeagueId)
    const prior = priorEntryFor(fixture, previous)
    const id = matchIdFor(fixture, prior, reservedIds)
    reservedIds.add(id)
    const base = matchBase(fixture, competition, prior, id)

    if (FINISHED_STATUSES.has(base.status)) {
      const mappedGoals = mapGoalEvents(fixture?.events, { resolvePlayerId, fixtureTeams: fixture?.teams })
      const outcome = ({ win: 'W', draw: 'D', loss: 'L' })[fixtureOutcome(fixture, teamId)]
      const homePenaltyScore = integerOrNull(fixture?.score?.penalty?.home)
      const awayPenaltyScore = integerOrNull(fixture?.score?.penalty?.away)
      results.push({
        ...base,
        homeScore: integerOrNull(fixture?.goals?.home) ?? nonNegativeInteger(prior?.homeScore),
        awayScore: integerOrNull(fixture?.goals?.away) ?? nonNegativeInteger(prior?.awayScore),
        ...(outcome ? { outcome } : {}),
        ...(homePenaltyScore !== null && awayPenaltyScore !== null
          ? { homePenaltyScore, awayPenaltyScore }
          : {}),
        goals: mappedGoals.length > 0 ? mappedGoals : (Array.isArray(prior?.goals) ? prior.goals : []),
        _sortTimestamp: fixtureTimestamp(fixture),
      })
      continue
    }

    const parsedKickoff = Date.parse(fixture?.fixture?.date)
    const kickoff = Number.isNaN(parsedKickoff) ? (prior?.kickoff ?? null) : new Date(parsedKickoff).toISOString()
    const confirmed = Boolean(kickoff) && !UNCONFIRMED_STATUSES.has(base.status)
      && fixture?.fixture?.status?.short !== 'TBD'
    fixtures.push({
      providerId: base.providerId,
      ...(base.providerLeagueId === undefined ? {} : { providerLeagueId: base.providerLeagueId }),
      status: base.status,
      id: base.id,
      date: base.date,
      kickoff,
      confirmed,
      home: base.home,
      homeCode: base.homeCode,
      away: base.away,
      awayCode: base.awayCode,
      venue: base.venue,
      competition: base.competition,
      round: base.round,
      _sortTimestamp: fixtureTimestamp(fixture),
    })
  }

  const withoutSortKey = (entry) => {
    const snapshotEntry = { ...entry }
    delete snapshotEntry._sortTimestamp
    return snapshotEntry
  }
  results.sort((left, right) => right._sortTimestamp - left._sortTimestamp || left.id.localeCompare(right.id))
  fixtures.sort((left, right) => left._sortTimestamp - right._sortTimestamp || left.id.localeCompare(right.id))
  return { results: results.map(withoutSortKey), fixtures: fixtures.map(withoutSortKey) }
}

function localPlayerVariants(player) {
  const variants = [player?.name, player?.shortName, player?.fullName]
    .map(normalizeName)
    .filter(Boolean)
  return new Set(variants)
}

function providerPlayerVariants(player) {
  const variants = [
    player?.name,
    [player?.firstname, player?.lastname].filter(Boolean).join(' '),
    player?.lastname,
  ].map(normalizeName).filter(Boolean)
  return new Set(variants)
}

function uniquePlayerMatch(providerPlayer, localPlayers) {
  const providerVariants = providerPlayerVariants(providerPlayer)
  let matches = localPlayers.filter((localPlayer) => {
    const localVariants = localPlayerVariants(localPlayer)
    return [...providerVariants].some((variant) => localVariants.has(variant))
  })
  if (matches.length === 1) return matches[0]

  const surname = normalizeName(providerPlayer?.lastname)
  if (!surname) return null
  matches = localPlayers.filter((localPlayer) => (
    [...localPlayerVariants(localPlayer)].some((variant) => variant.split(' ').at(-1) === surname)
  ))
  return matches.length === 1 ? matches[0] : null
}

export function mapProviderPlayers(apiRows, localPlayers = [], existingMappings = {}) {
  const localById = new Map(asArray(localPlayers).map((player) => [integerOrNull(player?.id), player]))
  const mappings = {}

  for (const [providerIdValue, localIdValue] of Object.entries(existingMappings || {})) {
    const providerId = integerOrNull(providerIdValue)
    const localId = integerOrNull(localIdValue)
    if (providerId !== null && localById.has(localId)) mappings[String(providerId)] = localId
  }

  const providerPlayersById = new Map()
  for (const row of asArray(apiRows)) {
    const player = row?.player || row
    const providerId = integerOrNull(player?.id)
    if (providerId === null) continue

    const mappedId = mappings[String(providerId)]
    const matched = mappedId ? localById.get(mappedId) : uniquePlayerMatch(player, asArray(localPlayers))
    const localPlayerId = integerOrNull(matched?.id) ?? integerOrNull(mappedId)
    if (localPlayerId !== null) mappings[String(providerId)] = localPlayerId
    const statistics = asArray(row?.statistics)[0] || {}
    const position = textOrNull(statistics?.games?.position) || textOrNull(matched?.position) || 'Player'
    const role = textOrNull(matched?.role) || position
    const name = textOrNull(player?.name) || textOrNull(matched?.name) || `Player ${providerId}`
    providerPlayersById.set(providerId, {
      id: `api-${providerId}`,
      providerId,
      name,
      shortName: textOrNull(matched?.shortName) || name,
      number: integerOrNull(statistics?.games?.number) ?? textOrNull(matched?.number) ?? '—',
      position,
      role,
      image: textOrNull(player?.photo) || textOrNull(matched?.image),
      localPlayerId,
    })
  }

  const resolvePlayerId = (value) => {
    const providerId = integerOrNull(typeof value === 'object' ? value?.id ?? value?.providerId : value)
    if (providerId !== null && mappings[String(providerId)] !== undefined) {
      return mappings[String(providerId)]
    }
    if (value && typeof value === 'object') {
      const matchedId = integerOrNull(uniquePlayerMatch(value, asArray(localPlayers))?.id)
      if (matchedId !== null) return matchedId
    }
    return providerId === null ? null : `api-${providerId}`
  }

  return {
    mappings,
    providerPlayers: [...providerPlayersById.values()].sort((left, right) => left.providerId - right.providerId),
    resolvePlayerId,
  }
}

function allowedLeagueIds(leagueIds) {
  if (leagueIds instanceof Set) return new Set([...leagueIds].map(Number))
  if (Array.isArray(leagueIds)) return new Set(leagueIds.map(Number))
  return null
}

export function aggregatePlayerStats(apiRows, { teamId, leagueIds, resolvePlayerId } = {}) {
  const allowedLeagues = allowedLeagueIds(leagueIds)
  const totals = new Map()
  const seen = new Set()

  for (const row of asArray(apiRows)) {
    const providerId = integerOrNull(row?.player?.id)
    const localId = playerReference(typeof resolvePlayerId === 'function'
      ? resolvePlayerId(row?.player || providerId)
      : providerId)
    if (localId === null) continue

    for (const statistics of asArray(row?.statistics)) {
      const statisticsTeamId = integerOrNull(statistics?.team?.id)
      const leagueId = integerOrNull(statistics?.league?.id)
      if (Number.isFinite(Number(teamId)) && statisticsTeamId !== Number(teamId)) continue
      if (allowedLeagues && !allowedLeagues.has(leagueId)) continue
      if (!isCompetitiveCompetition(statistics?.league || {})) continue

      const identity = `${providerId ?? localId}|${statisticsTeamId}|${leagueId}`
      if (seen.has(identity)) continue
      seen.add(identity)

      const current = totals.get(localId) || {
        playerId: localId,
        appearances: 0,
        starts: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
      }
      current.appearances += nonNegativeInteger(statistics?.games?.appearences ?? statistics?.games?.appearances)
      current.starts += nonNegativeInteger(statistics?.games?.lineups ?? statistics?.games?.starts)
      current.minutes += nonNegativeInteger(statistics?.games?.minutes)
      current.goals += nonNegativeInteger(statistics?.goals?.total)
      current.assists += nonNegativeInteger(statistics?.goals?.assists)
      totals.set(localId, current)
    }
  }

  return [...totals.values()].sort((left, right) => String(left.playerId).localeCompare(
    String(right.playerId),
    undefined,
    { numeric: true },
  ))
}

function standingGroups(standings) {
  if (!Array.isArray(standings)) return []
  if (standings.every((row) => row && !Array.isArray(row) && (row.team || row.rank))) return [standings]
  return standings.flatMap((entry) => standingGroups(entry))
}

function ordinal(number) {
  const remainder100 = number % 100
  if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`
  return `${number}${({ 1: 'st', 2: 'nd', 3: 'rd' })[number % 10] || 'th'}`
}

function seasonDisplay(value) {
  if (typeof value === 'string' && /^\d{4}\/\d{2}$/.test(value)) return value
  const season = integerOrNull(value)
  return season === null ? String(value || '') : `${season}/${String(season + 1).slice(-2)}`
}

function standingDescription(row, group, competition) {
  const position = nonNegativeInteger(row?.rank)
  const normalizedCompetition = normalizeName(competition?.name)
  if (position === 1) {
    const runnerUp = [...group].sort((left, right) => Number(left?.rank) - Number(right?.rank))[1]
    const difference = Number(row?.points || 0) - Number(runnerUp?.points || 0)
    const rival = runnerUp?.team?.name || 'second place'
    let note = `Level on points with ${rival}`
    if (difference === 1) note = `1 point clear of ${rival}`
    else if (difference > 1) note = `${difference} points clear of ${rival}`
    return { label: 'League leaders', note }
  }

  if (normalizedCompetition.includes('champions league')) {
    if (position <= 8) {
      return { label: 'Direct round of 16 zone', note: 'Inside the league phase top eight' }
    }
    if (position <= 24) {
      return { label: 'Knockout phase play-off zone', note: 'Inside the league phase top 24' }
    }
    return { label: 'Outside the knockout places', note: 'Outside the league phase top 24' }
  }

  return {
    label: textOrNull(row?.description) || `${ordinal(position)} place`,
    note: textOrNull(row?.group) || `${ordinal(position)} in ${competition?.name || 'the competition'}`,
  }
}

function stageLabel(row, competition) {
  const played = nonNegativeInteger(row?.all?.played)
  const total = integerOrNull(competition?.totalMatchdays)
  const prefix = normalizeName(competition?.name).includes('champions league') ? 'League phase · ' : ''
  if (total !== null) return `${prefix}Matchday ${played} of ${total}`
  const group = textOrNull(row?.group)
  return group ? `${group} · Matchday ${played}` : `Matchday ${played}`
}

export function normalizeStandings(apiResponse, { teamId, competition } = {}) {
  const configuredTeamId = Number(teamId)
  for (const responseRow of asArray(apiResponse)) {
    const league = responseRow?.league || responseRow
    const metadata = competition || {
      ...competitionMetadata(league),
      providerLeagueId: integerOrNull(league?.id),
    }
    const groups = standingGroups(league?.standings)
    const group = groups.find((candidate) => (
      candidate.some((row) => Number(row?.team?.id) === configuredTeamId)
    ))
    if (!group) continue

    const row = group.find((candidate) => Number(candidate?.team?.id) === configuredTeamId)
    const position = nonNegativeInteger(row?.rank)
    const description = standingDescription(row, group, metadata)
    const form = String(row?.form || '').toUpperCase().split('').filter((value) => ['W', 'D', 'L'].includes(value))
    const providerLeagueId = integerOrNull(metadata?.providerLeagueId ?? league?.id)

    return {
      providerLeagueId,
      id: metadata?.id || competitionMetadata(league).id,
      competition: metadata?.name || league?.name || 'Competition',
      season: seasonDisplay(metadata?.season ?? league?.season),
      stage: stageLabel(row, metadata),
      position,
      positionLabel: ordinal(position),
      totalTeams: group.length,
      played: nonNegativeInteger(row?.all?.played),
      wins: nonNegativeInteger(row?.all?.win),
      draws: nonNegativeInteger(row?.all?.draw),
      losses: nonNegativeInteger(row?.all?.lose),
      goalsFor: nonNegativeInteger(row?.all?.goals?.for),
      goalsAgainst: nonNegativeInteger(row?.all?.goals?.against),
      goalDifference: Number(row?.goalsDiff || 0),
      points: nonNegativeInteger(row?.points),
      form,
      standingLabel: description.label,
      standingNote: description.note,
      sourceLabel: metadata?.sourceLabel || 'Competition data',
      sourceUrl: metadata?.sourceUrl || 'https://www.api-football.com/',
    }
  }
  return null
}

export function normalizeAllStandings(apiResponse, options = {}) {
  const rows = asArray(apiResponse)
  return rows.map((row) => normalizeStandings([row], options)).filter(Boolean)
}

export function shouldRunScheduled(snapshot, now = new Date(), config = {}) {
  const currentTime = now instanceof Date ? now.getTime() : Date.parse(now)
  if (Number.isNaN(currentTime)) return false
  const startMinutes = Number(config?.scheduledWindowStartMinutes ?? 95)
  const endMinutes = Number(config?.scheduledWindowEndMinutes ?? 360)
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes < startMinutes) return false

  return asArray(snapshot?.fixtures).some((fixture) => {
    const status = String(fixture?.status || '').toUpperCase()
    if (FINISHED_STATUSES.has(status) || CANCELLED_STATUSES.has(status)) return false
    const kickoff = Date.parse(fixture?.kickoff)
    if (Number.isNaN(kickoff)) return false
    const minute = 60 * 1000
    const effectiveStartMinutes = LIVE_STATUSES.has(status) ? 0 : startMinutes
    return currentTime >= kickoff + (effectiveStartMinutes * minute) && currentTime <= kickoff + (endMinutes * minute)
  })
}

function canonicalSortKey(value, parentKey) {
  if (parentKey === 'results') return `${String(9999999999999 - Date.parse(value?.date || 0)).padStart(13, '0')}|${value?.id}`
  if (parentKey === 'fixtures') return `${value?.kickoff || value?.date || ''}|${value?.id}`
  if (parentKey === 'playerStats') return String(value?.playerId).padStart(12, '0')
  if (parentKey === 'standings') return `${String(value?.providerLeagueId).padStart(12, '0')}|${value?.id}`
  if (parentKey === 'providerPlayers') return String(value?.providerId).padStart(12, '0')
  if (parentKey === 'goals') return `${String(minuteSortValue(value?.minute)).padStart(12, '0')}|${value?.scorer}`
  return JSON.stringify(value)
}

function canonicalValue(value, parentKey = '') {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => canonicalValue(entry, parentKey))
    const orderIndependentCollections = new Set([
      'results', 'fixtures', 'playerStats', 'standings', 'providerPlayers', 'goals', 'competitions',
    ])
    return orderIndependentCollections.has(parentKey)
      ? normalized.sort((left, right) => canonicalSortKey(left, parentKey).localeCompare(canonicalSortKey(right, parentKey)))
      : normalized
  }
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
    if (key === 'generatedAt') return []
    if (parentKey === 'source' && VOLATILE_SOURCE_KEYS.has(key)) return []
    return [[key, canonicalValue(value[key], key)]]
  }))
}

export function canonicalizeSnapshot(snapshot) {
  return canonicalValue(snapshot)
}

export function canonicalSnapshotContent(snapshot) {
  return JSON.stringify(canonicalizeSnapshot(snapshot))
}

export const canonicalContent = canonicalSnapshotContent

export function hasCanonicalChanges(previousSnapshot, nextSnapshot) {
  return canonicalSnapshotContent(previousSnapshot) !== canonicalSnapshotContent(nextSnapshot)
}

export function sameCanonicalContent(left, right) {
  return !hasCanonicalChanges(left, right)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function requiredString(errors, value, path) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${path} must be a non-empty string.`)
}

function requiredNonNegativeInteger(errors, value, path) {
  if (!Number.isInteger(value) || value < 0) errors.push(`${path} must be a non-negative integer.`)
}

function validateMatchBase(errors, entry, path, ids, providerIds) {
  if (!isPlainObject(entry)) {
    errors.push(`${path} must be an object.`)
    return
  }
  requiredString(errors, entry.id, `${path}.id`)
  if (ids.has(entry.id)) errors.push(`${path}.id duplicates ${entry.id}.`)
  ids.add(entry.id)
  if (entry.providerId !== null && entry.providerId !== undefined) {
    if (!Number.isInteger(entry.providerId) || entry.providerId <= 0) {
      errors.push(`${path}.providerId must be null or a positive integer.`)
    } else if (providerIds.has(entry.providerId)) {
      errors.push(`${path}.providerId duplicates ${entry.providerId}.`)
    } else providerIds.add(entry.providerId)
  }
  if (entry.providerLeagueId !== undefined && (!Number.isInteger(entry.providerLeagueId) || entry.providerLeagueId <= 0)) {
    errors.push(`${path}.providerLeagueId must be a positive integer when present.`)
  }
  requiredString(errors, entry.status, `${path}.status`)
  if (!validDate(entry.date)) errors.push(`${path}.date must use YYYY-MM-DD.`)
  for (const key of ['home', 'homeCode', 'away', 'awayCode', 'venue', 'competition', 'round']) {
    requiredString(errors, entry[key], `${path}.${key}`)
  }
}

function validateResults(errors, results, ids, providerIds) {
  results.forEach((result, index) => {
    const path = `results[${index}]`
    validateMatchBase(errors, result, path, ids, providerIds)
    if (!isPlainObject(result)) return
    if (!FINISHED_STATUSES.has(result.status)) errors.push(`${path}.status must be a finished status.`)
    requiredNonNegativeInteger(errors, result.homeScore, `${path}.homeScore`)
    requiredNonNegativeInteger(errors, result.awayScore, `${path}.awayScore`)
    if (result.outcome !== undefined && !['W', 'D', 'L'].includes(result.outcome)) {
      errors.push(`${path}.outcome must be W, D, or L when present.`)
    }
    const hasHomePenalties = result.homePenaltyScore !== undefined
    const hasAwayPenalties = result.awayPenaltyScore !== undefined
    if (hasHomePenalties !== hasAwayPenalties) {
      errors.push(`${path} must contain both penalty-shootout scores or neither.`)
    } else if (hasHomePenalties) {
      requiredNonNegativeInteger(errors, result.homePenaltyScore, `${path}.homePenaltyScore`)
      requiredNonNegativeInteger(errors, result.awayPenaltyScore, `${path}.awayPenaltyScore`)
    }
    if (result.status === 'PEN') {
      if (!hasHomePenalties || !hasAwayPenalties) {
        errors.push(`${path} must include a decisive penalty-shootout score.`)
      } else if (result.homePenaltyScore === result.awayPenaltyScore) {
        errors.push(`${path} penalty-shootout score must not be tied.`)
      } else {
        const barcelonaIsHome = result.homeCode === 'BAR'
        const barcelonaWon = barcelonaIsHome
          ? result.homePenaltyScore > result.awayPenaltyScore
          : result.awayPenaltyScore > result.homePenaltyScore
        const expectedOutcome = barcelonaWon ? 'W' : 'L'
        if (result.outcome !== expectedOutcome) {
          errors.push(`${path}.outcome must agree with the penalty-shootout score.`)
        }
      }
    }
    if (!Array.isArray(result.goals)) {
      errors.push(`${path}.goals must be an array.`)
      return
    }
    result.goals.forEach((goal, goalIndex) => {
      const goalPath = `${path}.goals[${goalIndex}]`
      if (!isPlainObject(goal)) {
        errors.push(`${goalPath} must be an object.`)
        return
      }
      requiredString(errors, goal.teamCode, `${goalPath}.teamCode`)
      if (!parseEventMinute(goal.minute)) errors.push(`${goalPath}.minute is invalid.`)
      requiredString(errors, goal.scorer, `${goalPath}.scorer`)
      if (!GOAL_TYPES.has(goal.type)) errors.push(`${goalPath}.type is invalid.`)
      for (const key of ['scorerId', 'assistId']) {
        if (goal[key] !== null && playerReference(goal[key]) === null) {
          errors.push(`${goalPath}.${key} must be null, a positive integer, or an API player reference.`)
        }
      }
      if (goal.assist !== null && (typeof goal.assist !== 'string' || goal.assist.trim() === '')) {
        errors.push(`${goalPath}.assist must be null or a non-empty string.`)
      }
    })
  })
}

function validateFixtures(errors, fixtures, ids, providerIds) {
  fixtures.forEach((fixture, index) => {
    const path = `fixtures[${index}]`
    validateMatchBase(errors, fixture, path, ids, providerIds)
    if (!isPlainObject(fixture)) return
    if (FINISHED_STATUSES.has(fixture.status)) errors.push(`${path}.status cannot be a finished status.`)
    if (fixture.kickoff !== null && Number.isNaN(Date.parse(fixture.kickoff))) {
      errors.push(`${path}.kickoff must be null or a valid date/time.`)
    }
    if (typeof fixture.confirmed !== 'boolean') errors.push(`${path}.confirmed must be a boolean.`)
  })
}

function validatePlayerData(errors, snapshot) {
  const localIds = new Set()
  snapshot.playerStats.forEach((stat, index) => {
    const path = `playerStats[${index}]`
    if (!isPlainObject(stat)) {
      errors.push(`${path} must be an object.`)
      return
    }
    if (playerReference(stat.playerId) === null) errors.push(`${path}.playerId must be a positive integer or API player reference.`)
    if (localIds.has(stat.playerId)) errors.push(`${path}.playerId duplicates ${stat.playerId}.`)
    localIds.add(stat.playerId)
    for (const key of ['appearances', 'starts', 'minutes', 'goals', 'assists']) {
      requiredNonNegativeInteger(errors, stat[key], `${path}.${key}`)
    }
    if (stat.starts > stat.appearances) errors.push(`${path}.starts cannot exceed appearances.`)
  })

  const providerIds = new Set()
  snapshot.providerPlayers.forEach((player, index) => {
    const path = `providerPlayers[${index}]`
    if (!isPlainObject(player)) {
      errors.push(`${path} must be an object.`)
      return
    }
    if (!Number.isInteger(player.providerId) || player.providerId <= 0) errors.push(`${path}.providerId must be positive.`)
    if (providerIds.has(player.providerId)) errors.push(`${path}.providerId duplicates ${player.providerId}.`)
    providerIds.add(player.providerId)
    if (player.id !== `api-${player.providerId}`) errors.push(`${path}.id must match its API player reference.`)
    requiredString(errors, player.name, `${path}.name`)
    for (const key of ['shortName', 'position', 'role']) requiredString(errors, player[key], `${path}.${key}`)
    if (player.image !== null && (typeof player.image !== 'string' || player.image.trim() === '')) {
      errors.push(`${path}.image must be null or a non-empty string.`)
    }
    if (player.localPlayerId !== null && (!Number.isInteger(player.localPlayerId) || player.localPlayerId <= 0)) {
      errors.push(`${path}.localPlayerId must be null or a positive integer.`)
    }
  })
}

function validateStandings(errors, standings) {
  const ids = new Set()
  standings.forEach((standing, index) => {
    const path = `standings[${index}]`
    if (!isPlainObject(standing)) {
      errors.push(`${path} must be an object.`)
      return
    }
    if (!Number.isInteger(standing.providerLeagueId) || standing.providerLeagueId <= 0) {
      errors.push(`${path}.providerLeagueId must be positive.`)
    }
    requiredString(errors, standing.id, `${path}.id`)
    if (ids.has(standing.id)) errors.push(`${path}.id duplicates ${standing.id}.`)
    ids.add(standing.id)
    for (const key of [
      'competition', 'season', 'stage', 'positionLabel', 'standingLabel', 'standingNote', 'sourceLabel', 'sourceUrl',
    ]) requiredString(errors, standing[key], `${path}.${key}`)
    for (const key of [
      'position', 'totalTeams', 'played', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'points',
    ]) requiredNonNegativeInteger(errors, standing[key], `${path}.${key}`)
    if (!Number.isInteger(standing.goalDifference)) errors.push(`${path}.goalDifference must be an integer.`)
    if (standing.position < 1 || standing.position > standing.totalTeams) errors.push(`${path}.position is outside the table.`)
    if (standing.played !== standing.wins + standing.draws + standing.losses) {
      errors.push(`${path}.played must equal wins + draws + losses.`)
    }
    if (standing.goalDifference !== standing.goalsFor - standing.goalsAgainst) {
      errors.push(`${path}.goalDifference does not match the goals totals.`)
    }
    if (!Array.isArray(standing.form) || standing.form.some((value) => !['W', 'D', 'L'].includes(value))) {
      errors.push(`${path}.form must contain only W, D, or L.`)
    }
  })
}

export function snapshotValidationErrors(snapshot) {
  const errors = []
  if (!isPlainObject(snapshot)) return ['snapshot must be an object.']
  if (snapshot.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (Number.isNaN(Date.parse(snapshot.generatedAt))) errors.push('generatedAt must be a valid date/time.')
  if (!isPlainObject(snapshot.source)) errors.push('source must be an object.')
  else {
    requiredString(errors, snapshot.source.name, 'source.name')
    if (!Number.isInteger(snapshot.source.teamId) || snapshot.source.teamId <= 0) errors.push('source.teamId must be positive.')
    if (!Number.isInteger(snapshot.source.season) || snapshot.source.season < 2000) errors.push('source.season is invalid.')
  }
  if (!isPlainObject(snapshot.providerMappings) || !isPlainObject(snapshot.providerMappings?.players)) {
    errors.push('providerMappings.players must be an object.')
  }
  for (const key of ['providerPlayers', 'results', 'fixtures', 'playerStats', 'standings']) {
    if (!Array.isArray(snapshot[key])) errors.push(`${key} must be an array.`)
  }
  if (errors.some((error) => error.endsWith('must be an array.'))) return errors

  const ids = new Set()
  const providerIds = new Set()
  validateResults(errors, snapshot.results, ids, providerIds)
  validateFixtures(errors, snapshot.fixtures, ids, providerIds)
  validatePlayerData(errors, snapshot)
  validateStandings(errors, snapshot.standings)
  return errors
}

export class SnapshotValidationError extends Error {
  constructor(errors) {
    super(`Football data validation failed:\n- ${errors.join('\n- ')}`)
    this.name = 'SnapshotValidationError'
    this.errors = errors
  }
}

export function validateSnapshot(snapshot) {
  const errors = snapshotValidationErrors(snapshot)
  if (errors.length > 0) throw new SnapshotValidationError(errors)
  return snapshot
}
