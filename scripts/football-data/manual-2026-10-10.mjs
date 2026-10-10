// Public records reviewed on 10 October 2026, before Barcelona–Getafe kicks off.
// Match facts: FC Barcelona match centres and LaLiga commentary (linked per result).
// Player totals: official LaLiga table plus UEFA's sole completed European match.
import { players } from '../../src/data/players.js'

export const reviewedAt = '2026-10-10T10:30:00Z'
export const resultsSource = 'https://www.fcbarcelona.com/en/football/first-team/results'
export const scheduleSource = 'https://www.fcbarcelona.com/en/football/first-team/schedule'
export const leagueStatsSource = 'https://www.laliga.com/en-GB/clubs/fc-barcelona/stats'
export const europeanStatsSource = 'https://www.uefa.com/uefachampionsleague/clubs/50080--barcelona/squad/'
const leagueTableSource = 'https://www.fcbarcelona.com/en/football/first-team/standings'
const europeanTableSource = 'https://www.uefa.com/uefachampionsleague/standings/'
const superCupSource = 'https://rfef.es/en/noticias/Roadmap-Set-for-the-2027-Spanish-Super-Cup-in-Istanbul'
const eventSources = {
  '2026-08-23': 'https://www.laliga.com/en-US/match/temporada-2026-2027-laliga-ea-sports-elche-cf-fc-barcelona-2',
  '2026-08-27': 'https://www.laliga.com/en-BR/match/temporada-2026-2027-laliga-ea-sports-fc-barcelona-athletic-club-1',
  '2026-08-31': 'https://www.laliga.com/en-US/match/temporada-2026-2027-laliga-ea-sports-fc-barcelona-rayo-vallecano-3',
  '2026-09-06': 'https://www.laliga.com/en-NL/match/temporada-2026-2027-laliga-ea-sports-valencia-cf-fc-barcelona-4',
  '2026-09-09': 'https://www.laliga.com/partido/temporada-2026-2027-champions-league-fc-barcelona-feyenoord-1',
  '2026-09-13': 'https://www.laliga.com/en-NL/match/temporada-2026-2027-laliga-ea-sports-levante-ud-fc-barcelona-5',
  '2026-09-16': 'https://www.laliga.com/en-US/match/temporada-2026-2027-laliga-ea-sports-fc-barcelona-r-racing-club-6',
  '2026-09-19': 'https://www.laliga.com/en-US/match/temporada-2026-2027-laliga-ea-sports-sevilla-fc-fc-barcelona-7',
}

// Shirt number, appearances, starts, minutes, goals, assists. Zeroes below are
// published zeroes; missing players are omitted rather than assigned invented data.
export const leaguePlayerRows = [
  [1, 6, 6, 495, 0, 0], [2, 6, 2, 206, 1, 0], [3, 1, 0, 12, 0, 0],
  [4, 0, 0, 0, 0, 0], [5, 5, 5, 422, 0, 0], [6, 2, 1, 73, 0, 0],
  [7, 6, 5, 447, 4, 2], [8, 7, 6, 502, 1, 1], [9, 3, 0, 34, 1, 0],
  [10, 7, 7, 581, 7, 4], [11, 7, 7, 555, 12, 3], [12, 5, 5, 440, 1, 2],
  [13, 1, 0, 45, 0, 0], [14, 7, 2, 242, 2, 2], [15, 6, 4, 402, 0, 1],
  [16, 6, 4, 356, 0, 0], [17, 6, 5, 397, 0, 4], [18, 6, 5, 436, 0, 0],
  [20, 7, 2, 259, 0, 3], [22, 7, 3, 292, 0, 2], [23, 4, 1, 171, 0, 0],
  [24, 6, 6, 469, 0, 0], [25, 1, 1, 90, 0, 0], [29, 1, 0, 4, 0, 0],
]

// UEFA's published minutes are rounded individually, including substitutes.
export const europeanPlayerRows = [
  [1, 1, 1, 90, 0, 0], [2, 1, 1, 90, 0, 1], [5, 1, 1, 90, 0, 0],
  [15, 1, 1, 90, 0, 0], [23, 1, 1, 90, 0, 0], [16, 1, 1, 83, 0, 0],
  [8, 1, 1, 63, 0, 1], [20, 1, 1, 83, 0, 0], [10, 1, 1, 90, 1, 2],
  [11, 1, 1, 71, 2, 0], [14, 1, 1, 63, 1, 0], [22, 1, 0, 28, 0, 0],
  [17, 1, 0, 28, 0, 0], [7, 1, 0, 20, 0, 0], [6, 1, 0, 8, 0, 0],
  [9, 1, 0, 7, 1, 0],
]

const clubs = {
  BAR: ['Barcelona', 'Spotify Camp Nou'], ELC: ['Elche', 'Martínez Valero'],
  ATH: ['Athletic Club', 'San Mamés'], RAY: ['Rayo Vallecano', 'Estadio de Vallecas'],
  VAL: ['Valencia', 'Mestalla'], FEY: ['Feyenoord', 'De Kuip'],
  LEV: ['Levante', 'Ciutat de València'], RAC: ['Racing Santander', 'El Sardinero'],
  SEV: ['Sevilla', 'Ramón Sánchez-Pizjuán'], GET: ['Getafe', 'Coliseum'],
  GAL: ['Galatasaray', 'RAMS Park'], BET: ['Real Betis', 'Estadio La Cartuja de Sevilla'],
  PSG: ['Paris Saint-Germain', 'Parc des Princes'], RMA: ['Real Madrid', 'Estadio Bernabéu'],
  ALA: ['Alavés', 'Mendizorroza'], AVL: ['Aston Villa', 'Villa Park'],
  ATM: ['Atlético Madrid', 'Riyadh Air Metropolitano'], VIL: ['Villarreal', 'Estadio de la Cerámica'],
  SAB: ['Sabah', 'Baku Olympic Stadium'], DEP: ['Deportivo de La Coruña', 'ABANCA-Riazor'],
  CEL: ['Celta de Vigo', 'Estadio Abanca-Balaídos'], MCI: ['Manchester City', 'Etihad Stadium'],
  MAL: ['Málaga', 'La Rosaleda'], RSO: ['Real Sociedad', 'Reale Arena'],
  ESP: ['Espanyol', 'Stage Front Stadium'], OSA: ['Osasuna', 'El Sadar'],
  SPO: ['Sporting CP', 'Estádio José Alvalade'], COM: ['Como 1907', 'Stadio Giuseppe Sinigaglia'],
}
const byShirt = new Map(players.map((player) => [player.number, player]))

// Goal: credited team, minute, scorer shirt/name, assist shirt/name, optional type.
const matchRows = [
  ['2026-08-23', 'ELC', 'BAR', 0, 5, 'La Liga', 2, '138293/elche-fc-barcelona-la-liga-2026-2027', [
    ['BAR', '14', 11, null, 'penalty'], ['BAR', '45+3', 14, 11],
    ['BAR', '67', 11, 17], ['BAR', '71', 7, 17], ['BAR', '79', 7, 12],
  ]],
  ['2026-08-27', 'BAR', 'ATH', 2, 0, 'La Liga', 1, '138283/fc-barcelona-athletic-club-la-liga-2026-2027', [
    ['BAR', '37', 11, 8], ['BAR', '82', 7, null],
  ]],
  ['2026-08-31', 'BAR', 'RAY', 5, 2, 'La Liga', 3, '138302/fc-barcelona-rayo-vallecano-la-liga-2026-2027', [
    ['RAY', '12', 'Sergio Camello', 'Álvaro García'], ['BAR', '19', 11, 12],
    ['BAR', '21', 10, 22], ['BAR', '51', 'Florian Lejeune', null, 'own-goal'],
    ['RAY', '59', 'Sergio Camello', 'Unai López'], ['BAR', '71', 11, 17], ['BAR', '90', 10, 14],
  ]],
  ['2026-09-06', 'VAL', 'BAR', 0, 5, 'La Liga', 4, '138319/valencia-cf-fc-barcelona-la-liga-2026-2027', [
    ['BAR', '6', 10, 7], ['BAR', '22', 7, 17], ['BAR', '50', 11, 7],
    ['BAR', '79', 8, 20], ['BAR', '84', 10, 20],
  ]],
  ['2026-09-09', 'BAR', 'FEY', 5, 1, 'Champions League', 1, '141452/fc-barcelona-feyenoord-uefa-champions-league-2026-2027', [
    ['BAR', '3', 11, 10], ['BAR', '22', 14, 2], ['BAR', '57', 11, 8],
    ['BAR', '77', 10, null, 'free-kick'], ['FEY', '82', 'Sem Steijn', 'Gonçalo Borges'], ['BAR', '85', 9, 10],
  ]],
  ['2026-09-13', 'LEV', 'BAR', 2, 4, 'La Liga', 5, '138324/levante-fc-barcelona-la-liga-2026-2027', [
    ['BAR', '5', 12, 11], ['BAR', '19', 10, 11], ['BAR', '48', 10, null, 'penalty'],
    ['LEV', '79', 'Iván Romero', null], ['LEV', '88', 'Roger Brugué', null], ['BAR', '90+3', 14, 22],
  ]],
  ['2026-09-16', 'BAR', 'RAC', 7, 2, 'La Liga', 6, '138333/fc-barcelona-racing-de-santander-la-liga-2026-2027', [
    ['BAR', '8', 2, 10], ['BAR', '25', 11, null, 'penalty'],
    ['RAC', '30', 'Maguette Gueye', 'Asier Villalibre'], ['BAR', '36', 'Asier Villalibre', null, 'own-goal'],
    ['BAR', '42', 11, 20], ['RAC', '65', 'Yassir Zabiri', null],
    ['BAR', '67', 11, null, 'penalty'], ['BAR', '79', 9, 10], ['BAR', '89', 10, 14],
  ]],
  ['2026-09-19', 'SEV', 'BAR', 1, 3, 'La Liga', 7, '138348/sevilla-fc-barcelona-la-liga-2026-2027', [
    ['SEV', '19', 'Youssouf Fofana', 'Félix Correia'], ['BAR', '22', 11, 15],
    ['BAR', '52', 11, 10], ['BAR', '69', 11, 10],
  ]],
]

// UTC times are populated only where the club confirms them. TBA dates are the
// published matchday placeholders, not a claim that the exact day is confirmed.
const fixtureRows = [
  ['2026-10-10', 'BAR', 'GET', 'La Liga', 8, '16:30'],
  ['2026-10-13', 'GAL', 'BAR', 'Champions League', 2, '19:00'],
  ['2026-10-17', 'BET', 'BAR', 'La Liga', 9, '16:30'],
  ['2026-10-20', 'PSG', 'BAR', 'Champions League', 3, '19:00'],
  ['2026-10-25', 'BAR', 'RMA', 'La Liga', 10, '20:00'],
  ['2026-10-31', 'BAR', 'ALA', 'La Liga', 11, '20:00'],
  ['2026-11-03', 'BAR', 'AVL', 'Champions League', 4, '20:00'],
  ['2026-11-08', 'ATM', 'BAR', 'La Liga', 12],
  ['2026-11-22', 'BAR', 'VIL', 'La Liga', 13],
  ['2026-11-25', 'SAB', 'BAR', 'Champions League', 5, '17:45'],
  ['2026-11-29', 'DEP', 'BAR', 'La Liga', 14],
  ['2026-12-06', 'BAR', 'CEL', 'La Liga', 15],
  ['2026-12-08', 'BAR', 'MCI', 'Champions League', 6, '20:00'],
  ['2026-12-13', 'MAL', 'BAR', 'La Liga', 16],
  ['2026-12-20', 'BAR', 'RSO', 'La Liga', 17],
  ['2027-01-03', 'ESP', 'BAR', 'La Liga', 18],
  ['2027-01-10', 'OSA', 'BAR', 'La Liga', 19],
  ['2027-01-17', 'BAR', 'ELC', 'La Liga', 20],
  ['2027-01-20', 'SPO', 'BAR', 'Champions League', 7, '20:00'],
  ['2027-01-24', 'ALA', 'BAR', 'La Liga', 21],
  ['2027-01-27', 'BAR', 'COM', 'Champions League', 8, '20:00'],
  ['2027-01-31', 'BAR', 'VAL', 'La Liga', 22],
  ['2027-02-07', 'BAR', 'ATM', 'La Liga', 23],
  ['2027-02-14', 'VIL', 'BAR', 'La Liga', 24],
  ['2027-02-21', 'BAR', 'LEV', 'La Liga', 25],
  ['2027-02-28', 'ATH', 'BAR', 'La Liga', 26],
  ['2027-03-07', 'BAR', 'BET', 'La Liga', 27],
  ['2027-03-14', 'BAR', 'DEP', 'La Liga', 28],
  ['2027-03-21', 'RAY', 'BAR', 'La Liga', 29],
  ['2027-04-04', 'BAR', 'SEV', 'La Liga', 30],
  ['2027-04-11', 'RAC', 'BAR', 'La Liga', 31],
  ['2027-04-18', 'BAR', 'ESP', 'La Liga', 32],
  ['2027-04-21', 'CEL', 'BAR', 'La Liga', 33],
  ['2027-05-02', 'BAR', 'OSA', 'La Liga', 34],
  ['2027-05-09', 'RMA', 'BAR', 'La Liga', 35],
  ['2027-05-16', 'RSO', 'BAR', 'La Liga', 36],
  ['2027-05-23', 'BAR', 'MAL', 'La Liga', 37],
  ['2027-05-30', 'GET', 'BAR', 'La Liga', 38],
]

function playerName(value) {
  if (typeof value !== 'number') return value
  const player = byShirt.get(value)
  if (!player) throw new Error(`Unknown Barcelona shirt number ${value}`)
  return player.name
}

function matchBase(date, homeCode, awayCode, competition, matchday) {
  return {
    id: `${homeCode.toLowerCase()}-${awayCode.toLowerCase()}-${date}`,
    providerId: null,
    providerLeagueId: competition === 'La Liga' ? 302 : 3,
    date, home: clubs[homeCode][0], homeCode, away: clubs[awayCode][0], awayCode,
    venue: clubs[homeCode][1], competition,
    round: `${competition === 'Champions League' ? 'League phase · ' : ''}Matchday ${matchday}`,
  }
}

export function buildManualSnapshot() {
  const statsByPlayer = new Map()
  for (const [shirt, appearances, starts, minutes, goals, assists] of [...leaguePlayerRows, ...europeanPlayerRows]) {
    const player = byShirt.get(shirt)
    if (!player) throw new Error(`Unknown Barcelona shirt number ${shirt}`)
    const total = statsByPlayer.get(player.id) || { playerId: player.id, appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0 }
    for (const [field, value] of Object.entries({ appearances, starts, minutes, goals, assists })) total[field] += value
    statsByPlayer.set(player.id, total)
  }

  const results = matchRows.map(([date, home, away, homeScore, awayScore, competition, matchday, matchPath, goals]) => ({
    ...matchBase(date, home, away, competition, matchday),
    status: 'FT', homeScore, awayScore, outcome: 'W',
    sourceUrl: `https://www.fcbarcelona.com/en/matches/${matchPath}`,
    eventSourceUrl: eventSources[date],
    goals: goals.map(([teamCode, minute, scorer, assist, type = 'goal']) => ({
      teamCode, minute, scorer: playerName(scorer),
      scorerId: typeof scorer === 'number' ? byShirt.get(scorer).id : null,
      assist: playerName(assist), assistId: typeof assist === 'number' ? byShirt.get(assist).id : null, type,
    })),
  })).sort((a, b) => b.date.localeCompare(a.date))

  const standings = [
    {
      providerLeagueId: 302, id: 'la-liga', competition: 'La Liga', season: '2026/27',
      stage: 'Matchday 7 of 38', position: 1, positionLabel: '1st', totalTeams: 20,
      played: 7, wins: 7, draws: 0, losses: 0, goalsFor: 31, goalsAgainst: 7, goalDifference: 24,
      points: 21, form: ['W', 'W', 'W', 'W', 'W'], standingLabel: 'League leaders',
      standingNote: '5 points clear of Atlético Madrid', sourceLabel: 'Official club standings', sourceUrl: leagueTableSource,
    },
    {
      providerLeagueId: 3, id: 'champions-league', competition: 'Champions League', season: '2026/27',
      stage: 'League phase · Matchday 1 of 8', position: 3, positionLabel: '3rd', totalTeams: 36,
      played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4,
      points: 3, form: ['W'], standingLabel: 'Direct round of 16 zone',
      standingNote: 'Inside the league phase top eight', sourceLabel: 'Official UEFA standings', sourceUrl: europeanTableSource,
    },
  ]

  return {
    schemaVersion: 1, generatedAt: reviewedAt,
    source: {
      name: 'manual-public-sources', teamId: 97, teamName: 'Barcelona', teamCountry: 'Spain', season: 2026,
      reviewedAt, dataThrough: '2026-09-19', automaticUpdates: false,
      coverage: {
        results: 'All 8 completed competitive first-team matches through 19 September 2026.',
        playerStats: 'Official LaLiga totals plus UEFA Champions League totals; 24 players with published records. UEFA minutes use individual rounding.',
        fixtures: 'Official schedule checked 10 October 2026 before Barcelona–Getafe; unconfirmed kickoffs remain TBA.',
        standings: 'Official LaLiga and UEFA tables checked 10 October 2026; cup stages are listed separately.',
      },
      sources: [resultsSource, scheduleSource, leagueStatsSource, europeanStatsSource, leagueTableSource, europeanTableSource, superCupSource],
      competitions: standings.map((standing) => ({
        providerLeagueId: standing.providerLeagueId, id: standing.id, name: standing.competition,
        type: 'League', season: standing.season, hasStandings: true, hasEvents: true, hasPlayerStats: true,
        totalMatchdays: standing.id === 'la-liga' ? 38 : 8,
        sourceLabel: standing.sourceLabel, sourceUrl: standing.sourceUrl,
      })),
    },
    providerMappings: { players: {} }, providerPlayers: [], results,
    fixtures: fixtureRows.map(([date, home, away, competition, matchday, utcTime]) => ({
      ...matchBase(date, home, away, competition, matchday),
      status: utcTime ? 'NS' : 'TBD', kickoff: utcTime ? `${date}T${utcTime}:00Z` : null,
      confirmed: Boolean(utcTime), sourceUrl: scheduleSource,
    })),
    playerStats: [...statsByPlayer.values()].sort((a, b) => a.playerId - b.playerId),
    standings,
    cupStatuses: [
      {
        id: 'copa-del-rey', competition: 'Copa del Rey', stage: 'Round of 32 entry',
        status: 'Awaiting the draw',
        note: 'Barcelona have not played in the competition this season. Opponent and kickoff are to be confirmed.',
        sourceLabel: 'RFEF competition news', sourceUrl: 'https://rfef.es/es/noticias/competiciones-masculinas/copa-del-rey',
      },
      {
        id: 'spanish-super-cup', competition: 'Spanish Super Cup', stage: 'Semi-final',
        status: 'Barcelona vs Atlético Madrid',
        note: 'Scheduled for 2 February 2027 in Istanbul at Fenerbahçe’s stadium. No match has been played yet.',
        sourceLabel: 'RFEF tournament roadmap', sourceUrl: superCupSource,
      },
    ],
  }
}
