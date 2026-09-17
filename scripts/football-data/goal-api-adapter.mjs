import { normalizeName, teamCodeFor } from './model.mjs'

const STATUS_MAP = new Map([
  ['SCHEDULED', 'NS'],
  ['NOT_STARTED', 'NS'],
  ['TIMED', 'NS'],
  ['FINISHED', 'FT'],
  ['AFTER_ET', 'AET'],
  ['AFTER_EXTRA_TIME', 'AET'],
  ['AFTER_PEN', 'PEN'],
  ['AFTER_PENALTIES', 'PEN'],
  ['POSTPONED', 'PST'],
  ['CANCELLED', 'CANC'],
  ['CANCELED', 'CANC'],
  ['AWARDED', 'AWD'],
  ['ABANDONED', 'ABD'],
  ['SUSPENDED', 'SUSP'],
  ['INTERRUPTED', 'INT'],
])

const LIVE_PERIOD_MAP = new Map([
  ['NOT_STARTED', 'NS'],
  ['FIRST_HALF', '1H'],
  ['HALF_TIME', 'HT'],
  ['SECOND_HALF', '2H'],
  ['EXTRA_TIME', 'ET'],
  ['PENALTIES', 'P'],
  ['FINISHED', 'FT'],
])

function normalizedToken(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

function integerOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

function nonNegativeInteger(value, fallback = 0) {
  const number = integerOrNull(value)
  return number !== null && number >= 0 ? number : fallback
}

function textOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizedLookup(source, candidates) {
  if (!source) return undefined
  const values = candidates
    .filter((value) => value !== null && value !== undefined && value !== '')
  const normalizedCandidates = new Set(values.map((value) => normalizeName(value)).filter(Boolean))

  if (typeof source === 'function') {
    for (const candidate of values) {
      const found = source(candidate)
      if (found !== undefined) return found
    }
    return undefined
  }

  if (source instanceof Map) {
    for (const candidate of values) {
      if (source.has(candidate)) return source.get(candidate)
      if (source.has(String(candidate))) return source.get(String(candidate))
      const normalized = normalizeName(candidate)
      if (source.has(normalized)) return source.get(normalized)
    }
    for (const [key, value] of source) {
      if (normalizedCandidates.has(normalizeName(key))) return value
    }
    return undefined
  }

  if (typeof source === 'object') {
    for (const candidate of values) {
      if (Object.hasOwn(source, candidate)) return source[candidate]
      const normalized = normalizeName(candidate)
      if (Object.hasOwn(source, normalized)) return source[normalized]
    }
    for (const [key, value] of Object.entries(source)) {
      if (normalizedCandidates.has(normalizeName(key))) return value
    }
  }

  return undefined
}

function mappedId(source, name) {
  const mapped = normalizedLookup(source, [name])
  const value = mapped && typeof mapped === 'object'
    ? mapped.id ?? mapped.apiId ?? mapped.providerId
    : mapped
  const numeric = integerOrNull(value)
  return numeric !== null && numeric > 0 ? numeric : null
}

function fixtureDate(row) {
  const direct = Date.parse(row?.kickoffUtc)
  if (!Number.isNaN(direct)) return new Date(direct).toISOString()

  const date = String(row?.matchDate ?? '').trim()
  const time = String(row?.matchTime ?? '').trim() || '00:00'
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
  const combined = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(`${date}T${normalizedTime}Z`)
    : Date.parse(date)
  if (Number.isNaN(combined)) {
    throw new TypeError(`GOAL API fixture ${row?.apiId ?? row?.id ?? 'unknown'} has no valid UTC kickoff.`)
  }
  return new Date(combined).toISOString()
}

function parseSeasonStart(value) {
  const match = String(value ?? '').match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function fixtureRound(row) {
  const round = textOrNull(row?.matchRound)
  const stage = textOrNull(row?.stageName)
  if (round && stage && /^\d+$/.test(round) && normalizeName(round) !== normalizeName(stage)) {
    return `${stage} - ${round}`
  }
  return round || stage || 'To be confirmed'
}

function leagueMetadata(row, leagueByProviderId) {
  const candidates = [
    row?.leagueId,
    row?.league?.id,
    row?.league?.apiId,
    row?.leagueApiId,
    row?.leagueName,
    row?.league?.name,
  ]
  let metadata = normalizedLookup(leagueByProviderId, candidates)

  if (!metadata && leagueByProviderId) {
    const entries = leagueByProviderId instanceof Map
      ? [...leagueByProviderId.values()]
      : Object.values(leagueByProviderId)
    metadata = entries.find((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const identifiers = [entry.providerId, entry.goalProviderId, entry.apiId, entry.providerLeagueId, entry.id]
      return identifiers.some((identifier) => candidates.some(
        (candidate) => String(identifier ?? '') === String(candidate ?? ''),
      )) || candidates.some((candidate) => normalizeName(candidate) === normalizeName(entry.name))
    })
  }

  return metadata && typeof metadata === 'object' ? metadata : {}
}

function isConfiguredTeam(providerId, name, teamProviderId) {
  if (
    teamProviderId !== null
    && teamProviderId !== undefined
    && String(providerId ?? '') === String(teamProviderId)
  ) return true
  return ['barcelona', 'fc barcelona', 'futbol club barcelona'].includes(normalizeName(name))
}

function adaptedTeam(row, side, { teamProviderId, teamNumericId }) {
  const nested = row?.[`${side}Team`] || {}
  const providerId = row?.[`${side}TeamId`] ?? nested.id
  const name = textOrNull(row?.[`${side}TeamName`]) || textOrNull(nested.name) || 'TBD'
  const configured = isConfiguredTeam(providerId, name, teamProviderId)
  const id = configured
    ? positiveNumericId(teamNumericId, providerId || name)
    : positiveNumericId(
        nested.apiId ?? row?.[`${side}TeamApiId`] ?? providerId,
        `${side}:${name}`,
      )
  const suppliedCode = textOrNull(row?.[`${side}TeamCode`] ?? nested.code)

  return {
    id,
    name,
    code: configured ? 'BAR' : teamCodeFor({ name, code: suppliedCode }),
    logo: textOrNull(row?.[`${side}TeamBadge`] ?? nested.badge ?? nested.logo),
  }
}

function eventMinute(value) {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\s*\+\s*(\d+))?(?:')?$/)
  if (!match) return { elapsed: 0, extra: null }
  return {
    elapsed: Number(match[1]),
    extra: match[2] ? Number(match[2]) : null,
  }
}

function goalDetail(event) {
  const description = normalizeName(`${event?.type ?? ''} ${event?.info ?? ''}`)
  if (description.includes('own goal') || description.includes('own-goal')) return 'Own Goal'
  if (description.includes('free kick') || description.includes('freekick')) return 'Free Kick'
  if (description.includes('penalty')) return 'Penalty'
  return 'Normal Goal'
}

function adaptGoalEvents(events, teams, playerByName) {
  if (!Array.isArray(events)) return []

  return events.flatMap((event) => {
    const homeScorer = textOrNull(event?.homeScorer)
    const awayScorer = textOrNull(event?.awayScorer)
    const scorer = homeScorer || awayScorer
    if (!scorer) return []

    const eventKind = normalizeName(`${event?.type ?? ''} ${event?.info ?? ''}`)
    if (
      eventKind.includes('card')
      || eventKind.includes('substitution')
      || eventKind.includes('missed penalty')
      || eventKind.includes('penalty shootout')
    ) return []

    const isHome = Boolean(homeScorer)
    const assist = textOrNull(isHome ? event?.homeAssist : event?.awayAssist)
    const detail = goalDetail(event)
    // GOAL's scorer side is the side credited on the scoreboard. API-Football's
    // own-goal event team is the offending side, which the snapshot model flips.
    const eventTeam = detail === 'Own Goal'
      ? (isHome ? teams.away : teams.home)
      : (isHome ? teams.home : teams.away)
    return [{
      time: eventMinute(event?.time),
      team: eventTeam,
      player: { id: mappedId(playerByName, scorer), name: scorer },
      assist: { id: mappedId(playerByName, assist), name: assist },
      type: 'Goal',
      detail,
      comments: textOrNull(event?.info),
    }]
  })
}

function winnerFlags(status, goals, penalty) {
  if (!['FT', 'AET', 'PEN', 'AWD'].includes(status)) return { home: null, away: null }
  const decisive = status === 'PEN' && penalty.home !== null && penalty.away !== null
    ? penalty
    : goals
  if (decisive.home === null || decisive.away === null || decisive.home === decisive.away) {
    return { home: null, away: null }
  }
  return { home: decisive.home > decisive.away, away: decisive.away > decisive.home }
}

function normalizedForm(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const token = normalizedToken(entry)
        if (token === 'WIN') return 'W'
        if (token === 'DRAW') return 'D'
        if (token === 'LOSS' || token === 'LOSE') return 'L'
        return ['W', 'D', 'L'].includes(token) ? token : null
      })
      .filter(Boolean)
      .join('')
  }

  return String(value ?? '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .flatMap((token) => {
      if (token === 'WIN') return ['W']
      if (token === 'DRAW') return ['D']
      if (token === 'LOSS' || token === 'LOSE') return ['L']
      return token.length > 0 && [...token].every((letter) => ['W', 'D', 'L'].includes(letter))
        ? [...token]
        : []
    })
    .join('')
}

function formForStanding(row, suppliedForm, configured) {
  const selected = Array.isArray(suppliedForm) || typeof suppliedForm === 'string'
    ? (configured ? suppliedForm : undefined)
    : normalizedLookup(suppliedForm, [
        row?.teamId,
        row?.team?.id,
        row?.teamName,
        row?.team?.name,
      ])
  return normalizedForm(selected ?? row?.form ?? row?.recentForm)
}

function competitionLeague(competition, standings) {
  const providerLeagueId = positiveNumericId(
    competition?.providerLeagueId ?? competition?.apiId ?? competition?.numericId,
    competition?.providerId ?? competition?.id ?? competition?.name ?? 'goal-api-competition',
  )
  return {
    id: providerLeagueId,
    name: textOrNull(competition?.name) || 'Competition',
    season: parseSeasonStart(competition?.season) ?? integerOrNull(competition?.season),
    standings: [standings],
  }
}

function standingTeam(row, { teamNumericId, teamProviderId }, name, providerId, fallback) {
  const configured = isConfiguredTeam(providerId, name, teamProviderId)
  const id = configured
    ? positiveNumericId(teamNumericId, providerId || name)
    : positiveNumericId(
        row?.teamApiId ?? row?.team?.apiId ?? row?.apiId ?? providerId,
        fallback || name,
      )
  return { configured, team: { id, name } }
}

export function goalSeasonLabel(startYear) {
  const match = String(startYear ?? '').match(/\b(20\d{2})\b/)
  const year = match ? Number(match[1]) : Number.NaN
  if (!Number.isInteger(year)) throw new TypeError('GOAL API season must contain a four-digit start year.')
  return `${year}/${year + 1}`
}

export function goalStatusToApiFootball(status, period) {
  const lifecycle = normalizedToken(status)
  const matchPeriod = normalizedToken(period)
  if (lifecycle === 'HALF_TIME') return 'HT'
  if (lifecycle === 'LIVE' || lifecycle === 'IN_PLAY' || lifecycle === 'PAUSED') {
    return LIVE_PERIOD_MAP.get(matchPeriod) || (lifecycle === 'PAUSED' ? 'INT' : 'LIVE')
  }
  return STATUS_MAP.get(lifecycle) || LIVE_PERIOD_MAP.get(matchPeriod) || 'TBD'
}

export function positiveNumericId(value, fallback) {
  const direct = integerOrNull(value)
  if (direct !== null && direct > 0 && Number.isSafeInteger(direct)) return direct

  const source = textOrNull(value) || textOrNull(fallback) || 'goal-api-id'
  let hash = 2166136261
  for (const character of source) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) || 1
}

export function adaptGoalFixture(row, {
  teamProviderId,
  teamNumericId,
  leagueByProviderId,
  playerByName,
} = {}) {
  const date = fixtureDate(row)
  const metadata = leagueMetadata(row, leagueByProviderId)
  const status = goalStatusToApiFootball(row?.matchStatus ?? row?.status, row?.matchPeriod)
  const home = adaptedTeam(row, 'home', { teamProviderId, teamNumericId })
  const away = adaptedTeam(row, 'away', { teamProviderId, teamNumericId })
  const goals = {
    home: integerOrNull(row?.homeTeamScore ?? row?.homeScore),
    away: integerOrNull(row?.awayTeamScore ?? row?.awayScore),
  }
  const penalty = {
    home: integerOrNull(row?.homeTeamPenaltyScore ?? row?.homePenaltyScore),
    away: integerOrNull(row?.awayTeamPenaltyScore ?? row?.awayPenaltyScore),
  }
  const winners = winnerFlags(status, goals, penalty)
  const leagueId = positiveNumericId(
    metadata.providerLeagueId ?? metadata.numericId ?? metadata.apiId
      ?? row?.league?.apiId ?? row?.leagueApiId,
    row?.leagueId ?? row?.league?.id ?? row?.leagueName ?? metadata.name,
  )
  const fixtureId = positiveNumericId(row?.apiId, row?.id ?? `${date}:${home.name}:${away.name}`)

  home.winner = winners.home
  away.winner = winners.away

  return {
    fixture: {
      id: fixtureId,
      date,
      timestamp: Math.floor(Date.parse(date) / 1000),
      timezone: 'UTC',
      venue: {
        id: null,
        name: textOrNull(row?.matchStadium ?? row?.venue?.name),
        city: textOrNull(row?.venue?.city),
      },
      status: {
        long: textOrNull(row?.matchStatus ?? row?.status) || 'Unknown',
        short: status,
        elapsed: integerOrNull(row?.matchElapsed),
      },
    },
    league: {
      id: leagueId,
      name: textOrNull(metadata.name) || textOrNull(row?.league?.name) || textOrNull(row?.leagueName) || 'Competition',
      type: textOrNull(metadata.type) || 'Competition',
      country: textOrNull(row?.countryName),
      logo: textOrNull(row?.leagueLogo ?? row?.league?.logo),
      flag: textOrNull(row?.countryLogo),
      season: parseSeasonStart(row?.leagueYear ?? metadata.season),
      round: fixtureRound(row),
    },
    teams: { home, away },
    goals,
    score: {
      halftime: {
        home: integerOrNull(row?.homeTeamHalftimeScore),
        away: integerOrNull(row?.awayTeamHalftimeScore),
      },
      fulltime: {
        home: integerOrNull(row?.homeTeamFtScore) ?? goals.home,
        away: integerOrNull(row?.awayTeamFtScore) ?? goals.away,
      },
      extratime: {
        home: integerOrNull(row?.homeTeamExtraScore),
        away: integerOrNull(row?.awayTeamExtraScore),
      },
      penalty,
    },
    events: adaptGoalEvents(row?.events, { home, away }, playerByName),
  }
}

export function adaptGoalPlayers(rows, {
  teamNumericId,
  leagueNumericId,
  startsByProviderId,
} = {}) {
  if (!Array.isArray(rows)) return []

  return rows.map((row) => {
    const providerId = positiveNumericId(row?.apiId, row?.id ?? row?.name)
    const appearances = nonNegativeInteger(row?.matchPlayed ?? row?.appearances)
    const suppliedStarts = normalizedLookup(startsByProviderId, [row?.apiId, row?.id, providerId, row?.name])
    const starts = Math.min(
      appearances,
      nonNegativeInteger(
        suppliedStarts && typeof suppliedStarts === 'object'
          ? suppliedStarts.starts ?? suppliedStarts.lineups ?? suppliedStarts.count
          : suppliedStarts ?? row?.starts,
      ),
    )

    return {
      player: {
        id: providerId,
        name: textOrNull(row?.name) || `Player ${providerId}`,
        firstname: textOrNull(row?.firstname ?? row?.firstName),
        lastname: textOrNull(row?.lastname ?? row?.lastName),
        photo: textOrNull(row?.image ?? row?.photo),
      },
      statistics: [{
        team: { id: positiveNumericId(teamNumericId, row?.teamId ?? 'barcelona') },
        league: { id: positiveNumericId(leagueNumericId, 'goal-api-league') },
        games: {
          appearences: appearances,
          appearances,
          lineups: starts,
          starts,
          minutes: nonNegativeInteger(row?.minutes),
          number: integerOrNull(row?.number),
          position: textOrNull(row?.type ?? row?.position) || 'Player',
        },
        goals: {
          total: nonNegativeInteger(row?.goals),
          assists: nonNegativeInteger(row?.assists),
        },
      }],
    }
  })
}

export function adaptGoalStandings(rows, {
  teamNumericId,
  teamProviderId,
  competition,
  form,
} = {}) {
  const adaptedRows = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const name = textOrNull(row?.teamName ?? row?.team?.name) || `Team ${index + 1}`
    const providerId = row?.teamId ?? row?.team?.id
    const { configured, team } = standingTeam(
      row,
      { teamNumericId, teamProviderId },
      name,
      providerId,
      `goal-standing:${name}`,
    )
    const wins = nonNegativeInteger(row?.overallLeagueW ?? row?.wins)
    const draws = nonNegativeInteger(row?.overallLeagueD ?? row?.draws)
    const losses = nonNegativeInteger(row?.overallLeagueL ?? row?.losses)
    const goalsFor = nonNegativeInteger(row?.overallLeagueGF ?? row?.goalsFor)
    const goalsAgainst = nonNegativeInteger(row?.overallLeagueGA ?? row?.goalsAgainst)

    return {
      rank: nonNegativeInteger(row?.overallLeaguePosition ?? row?.position, index + 1),
      team,
      points: nonNegativeInteger(row?.overallLeaguePTS ?? row?.points),
      goalsDiff: goalsFor - goalsAgainst,
      group: textOrNull(row?.stageName ?? row?.group),
      description: textOrNull(row?.overallPromotion ?? row?.description),
      form: formForStanding(row, form, configured),
      all: {
        played: nonNegativeInteger(row?.overallLeaguePlayed ?? row?.played, wins + draws + losses),
        win: wins,
        draw: draws,
        lose: losses,
        goals: { for: goalsFor, against: goalsAgainst },
      },
    }
  })

  return [{ league: competitionLeague(competition, adaptedRows) }]
}

export function adaptBarcaStandings(rows, {
  teamNumericId,
  teamProviderId,
  competition,
  form,
} = {}) {
  const adaptedRows = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const rawTeam = row?.team
    const name = textOrNull(typeof rawTeam === 'object' ? rawTeam.name : rawTeam)
      || textOrNull(row?.teamName)
      || `Team ${index + 1}`
    const providerId = row?.teamId ?? (typeof rawTeam === 'object' ? rawTeam.id : undefined)
    const { configured, team } = standingTeam(
      row,
      { teamNumericId, teamProviderId },
      name,
      providerId,
      `barca-standing:${name}`,
    )
    const wins = nonNegativeInteger(row?.won ?? row?.wins)
    const draws = nonNegativeInteger(row?.drawn ?? row?.draws)
    const losses = nonNegativeInteger(row?.lost ?? row?.losses)
    const goalsFor = nonNegativeInteger(row?.goalsFor)
    const goalsAgainst = nonNegativeInteger(row?.goalsAgainst)

    return {
      rank: nonNegativeInteger(row?.position ?? row?.rank, index + 1),
      team,
      points: nonNegativeInteger(row?.points),
      goalsDiff: goalsFor - goalsAgainst,
      group: textOrNull(row?.stage ?? row?.group),
      description: textOrNull(row?.description),
      form: formForStanding(row, form, configured),
      all: {
        played: nonNegativeInteger(row?.played, wins + draws + losses),
        win: wins,
        draw: draws,
        lose: losses,
        goals: { for: goalsFor, against: goalsAgainst },
      },
    }
  })

  return [{ league: competitionLeague(competition, adaptedRows) }]
}
