import { players as localPlayers } from './players.js'
import snapshot, { formatSnapshotMatchDate, snapshotCheckedAt } from './snapshot.js'

function resultTime(result) {
  const timestamp = Date.parse(result.date ? `${result.date}T12:00:00Z` : '')
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

function normalizeProviderPlayer(player) {
  const id = player?.id ?? player?.playerId ?? player?.providerId
  if (id == null) return null

  const name = player.name || player.shortName || `Player ${id}`
  return {
    ...player,
    id,
    name,
    shortName: player.shortName || name,
    number: player.number ?? '—',
    position: player.position || player.role || 'Player',
    role: player.role || player.position || 'First team',
    image: player.image || player.photo || null,
  }
}

export const results = (Array.isArray(snapshot.results) ? snapshot.results : [])
  .map((result) => ({
    ...result,
    goals: Array.isArray(result.goals) ? result.goals.filter(Boolean) : [],
  }))
  .sort((first, second) => resultTime(second) - resultTime(first))

export const playerStats = Array.isArray(snapshot.playerStats) ? snapshot.playerStats : []
export const providerPlayers = (Array.isArray(snapshot.providerPlayers) ? snapshot.providerPlayers : [])
  .map(normalizeProviderPlayer)
  .filter(Boolean)

const resultPlayerMap = new Map()

function indexResultPlayer(player) {
  resultPlayerMap.set(String(player.id), player)
  if (player.playerId != null) resultPlayerMap.set(String(player.playerId), player)
  if (player.providerId != null) {
    resultPlayerMap.set(String(player.providerId), player)
    resultPlayerMap.set(`api-${player.providerId}`, player)
  }
}

for (const player of providerPlayers) indexResultPlayer(player)
for (const player of localPlayers) indexResultPlayer(player)

export const resultPlayers = [...new Map(
  [...providerPlayers, ...localPlayers].map((player) => [String(player.id), player]),
).values()]
export const resultCompetitions = ['All', ...new Set(results.map((result) => result.competition).filter(Boolean))]

export function getResultPlayer(playerId) {
  if (playerId == null) return null
  return resultPlayerMap.get(String(playerId)) || resultPlayerMap.get(`api-${playerId}`) || null
}

function parseScore(value) {
  if (value == null || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

export function getResultOutcome(result) {
  const recordedOutcome = typeof result?.outcome === 'string' ? result.outcome.toUpperCase() : null
  if (['W', 'D', 'L'].includes(recordedOutcome)) return recordedOutcome

  const barcelonaIsHome = result?.homeCode === 'BAR'
  const barcelonaScore = parseScore(barcelonaIsHome ? result?.homeScore : result?.awayScore)
  const opponentScore = parseScore(barcelonaIsHome ? result?.awayScore : result?.homeScore)
  if (barcelonaScore == null || opponentScore == null) return null
  if (barcelonaScore === opponentScore) return 'D'
  return barcelonaScore > opponentScore ? 'W' : 'L'
}

export const resultSummary = results.reduce((summary, result) => {
  const outcome = getResultOutcome(result)
  if (!outcome) return summary

  const barcelonaIsHome = result.homeCode === 'BAR'
  const goalsFor = parseScore(barcelonaIsHome ? result.homeScore : result.awayScore)
  const goalsAgainst = parseScore(barcelonaIsHome ? result.awayScore : result.homeScore)

  summary.played += 1
  summary.wins += outcome === 'W' ? 1 : 0
  summary.draws += outcome === 'D' ? 1 : 0
  summary.losses += outcome === 'L' ? 1 : 0
  summary.goalsFor += goalsFor ?? 0
  summary.goalsAgainst += goalsAgainst ?? 0
  summary.cleanSheets += goalsAgainst === 0 ? 1 : 0
  return summary
}, {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  cleanSheets: 0,
})

export const recentResults = results.slice(0, 3).map((result) => {
  const isHome = result.homeCode === 'BAR'
  return {
    id: result.id,
    opponent: isHome ? result.away : result.home,
    score: `${(isHome ? result.homeScore : result.awayScore) ?? '—'}–${(isHome ? result.awayScore : result.homeScore) ?? '—'}`,
    outcome: getResultOutcome(result) || '—',
    location: isHome ? 'Home' : 'Away',
  }
})

const latestResultDate = results.reduce(
  (latest, result) => (!latest || result.date > latest ? result.date : latest),
  null,
)

export const resultsCheckedAt = snapshotCheckedAt
export const playerStatsThrough = formatSnapshotMatchDate(latestResultDate)
