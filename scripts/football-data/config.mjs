export const API_BASE_URL = 'https://v3.football.api-sports.io'

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
])

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
  return {
    apiKey: environment.API_FOOTBALL_KEY || '',
    baseUrl: environment.API_FOOTBALL_BASE_URL || API_BASE_URL,
    teamId: parsePositiveInteger(environment.API_FOOTBALL_TEAM_ID, 529, 'API_FOOTBALL_TEAM_ID'),
    teamName: environment.API_FOOTBALL_TEAM_NAME || 'Barcelona',
    teamCountry: environment.API_FOOTBALL_TEAM_COUNTRY || 'Spain',
    season: parsePositiveInteger(environment.API_FOOTBALL_SEASON, 2026, 'API_FOOTBALL_SEASON'),
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
    sourceUrl: 'https://www.api-football.com/',
  }
}

export function isCompetitiveCompetition(league) {
  const name = String(league.name || '').toLowerCase()
  return !name.includes('friendly') && !name.includes('friendlies')
}
