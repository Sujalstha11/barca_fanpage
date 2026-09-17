export const API_BASE_URL = 'https://v3.football.api-sports.io'
export const GOAL_API_BASE_URL = 'https://api.goal-api.com/v1'
export const BARCA_API_BASE_URL = 'https://api.fc-barcelona.app'

export const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
export const CANCELLED_STATUSES = new Set(['CANC', 'ABD', 'AWD', 'WO'])

export const KNOWN_COMPETITIONS = new Map([
  [140, {
    id: 'la-liga',
    name: 'La Liga',
    totalMatchdays: 38,
    sourceLabel: 'Official La Liga standings',
    sourceUrl: 'https://www.fcbarcelona.com/en/football/first-team/standings',
  }],
  [2, {
    id: 'champions-league',
    name: 'Champions League',
    totalMatchdays: 8,
    sourceLabel: 'Official UEFA standings',
    sourceUrl: 'https://www.uefa.com/uefachampionsleague/standings/',
  }],
  [302, {
    id: 'la-liga',
    name: 'La Liga',
    totalMatchdays: 38,
    sourceLabel: 'GOAL API standings',
    sourceUrl: 'https://goal-api.com/coverage/spain-la-liga-api',
  }],
  [3, {
    id: 'champions-league',
    name: 'Champions League',
    totalMatchdays: 8,
    sourceLabel: 'Barça API standings',
    sourceUrl: 'https://api.fc-barcelona.app/en/docs',
  }],
])

const KNOWN_COMPETITION_NAMES = [
  {
    names: ['la liga', 'primera division'],
    metadata: KNOWN_COMPETITIONS.get(302),
  },
  {
    names: ['champions league', 'uefa champions league'],
    metadata: KNOWN_COMPETITIONS.get(3),
  },
]

export const TEAM_CODE_ALIASES = new Map([
  ['barcelona', 'BAR'],
  ['fc barcelona', 'BAR'],
  ['racing santander', 'RAC'],
  ['racing de santander', 'RAC'],
  ['r racing club', 'RAC'],
  ['sevilla', 'SEV'],
  ['sevilla fc', 'SEV'],
  ['getafe', 'GET'],
  ['getafe cf', 'GET'],
  ['galatasaray', 'GAL'],
  ['galatasaray sk', 'GAL'],
  ['real betis', 'BET'],
  ['real betis balompie', 'BET'],
  ['paris saint germain', 'PSG'],
  ['psg', 'PSG'],
  ['real madrid', 'RMA'],
  ['real madrid cf', 'RMA'],
  ['alaves', 'ALA'],
  ['deportivo alaves', 'ALA'],
  ['aston villa', 'AVL'],
  ['atletico madrid', 'ATM'],
  ['sabah', 'SAB'],
  ['sabah fk', 'SAB'],
  ['manchester city', 'MCI'],
  ['elche', 'ELC'],
  ['elche cf', 'ELC'],
  ['athletic club', 'ATH'],
  ['athletic bilbao', 'ATH'],
  ['rayo vallecano', 'RAY'],
  ['valencia', 'VAL'],
  ['valencia cf', 'VAL'],
  ['feyenoord', 'FEY'],
  ['levante', 'LEV'],
  ['levante ud', 'LEV'],
])

function parsePositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return parsed
}

export function createRuntimeConfig(environment = process.env) {
  const provider = environment.FOOTBALL_DATA_PROVIDER
    || (environment.GOAL_API_KEY ? 'goal-api' : 'api-football')
  if (!['goal-api', 'api-football'].includes(provider)) {
    throw new Error('FOOTBALL_DATA_PROVIDER must be either "goal-api" or "api-football".')
  }

  return {
    provider,
    apiKey: environment.API_FOOTBALL_KEY || '',
    baseUrl: environment.API_FOOTBALL_BASE_URL || API_BASE_URL,
    teamId: parsePositiveInteger(environment.API_FOOTBALL_TEAM_ID, 529, 'API_FOOTBALL_TEAM_ID'),
    teamName: environment.API_FOOTBALL_TEAM_NAME || 'Barcelona',
    teamCountry: environment.API_FOOTBALL_TEAM_COUNTRY || 'Spain',
    goalApiKey: environment.GOAL_API_KEY || '',
    goalBaseUrl: environment.GOAL_API_BASE_URL || GOAL_API_BASE_URL,
    barcaBaseUrl: environment.BARCA_API_BASE_URL || BARCA_API_BASE_URL,
    goalTeamApiId: environment.GOAL_API_TEAM_ID
      ? parsePositiveInteger(environment.GOAL_API_TEAM_ID, undefined, 'GOAL_API_TEAM_ID')
      : null,
    season: parsePositiveInteger(
      environment.FOOTBALL_DATA_SEASON ?? environment.GOAL_API_SEASON ?? environment.API_FOOTBALL_SEASON,
      2026,
      'FOOTBALL_DATA_SEASON',
    ),
    scheduledWindowStartMinutes: parsePositiveInteger(
      environment.FOOTBALL_SYNC_WINDOW_START_MINUTES,
      95,
      'FOOTBALL_SYNC_WINDOW_START_MINUTES',
    ),
    scheduledWindowEndMinutes: parsePositiveInteger(
      environment.FOOTBALL_SYNC_WINDOW_END_MINUTES,
      360,
      'FOOTBALL_SYNC_WINDOW_END_MINUTES',
    ),
  }
}

export function competitionMetadata(league) {
  const known = KNOWN_COMPETITIONS.get(Number(league.id))
  if (known) return { ...known }

  const normalizedName = String(league.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const knownByName = KNOWN_COMPETITION_NAMES.find(({ names }) => (
    names.some((name) => normalizedName === name || normalizedName.includes(name))
  ))
  if (knownByName) return { ...knownByName.metadata }

  const id = String(league.name || `competition-${league.id}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return {
    id,
    name: league.name || `Competition ${league.id}`,
    totalMatchdays: null,
    sourceLabel: 'Competition data',
    sourceUrl: 'https://goal-api.com/coverage',
  }
}

export function isCompetitiveCompetition(league) {
  const name = String(league.name || '').toLowerCase()
  return !name.includes('friendly') && !name.includes('friendlies')
}
