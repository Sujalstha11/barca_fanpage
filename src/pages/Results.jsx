import { BarChart3, Crosshair, ExternalLink, Filter, ShieldCheck, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import FilterChip from '../components/FilterChip.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PlayerPhoto from '../components/PlayerPhoto.jsx'
import ResultCard from '../components/ResultCard.jsx'
import { players } from '../data/players.js'
import { playerStats, results, resultSummary } from '../data/results.js'

const competitions = ['All', 'La Liga', 'Champions League']
const locations = ['All', 'Home', 'Away']
const playerById = new Map(players.map((player) => [player.id, player]))

const statsWithPlayers = playerStats.map((stat) => ({ ...stat, player: playerById.get(stat.playerId) }))
const goalscorers = [...statsWithPlayers].filter((stat) => stat.goals > 0).sort((a, b) => b.goals - a.goals)
const assistProviders = [...statsWithPlayers].filter((stat) => stat.assists > 0).sort((a, b) => b.assists - a.assists)

function Leaderboard({ title, note, entries, statKey, icon: Icon }) {
  return (
    <section className="rounded-3xl border border-white/8 bg-panel p-5 sm:p-7" aria-labelledby={`${statKey}-leaders`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Player leaders</p>
          <h2 id={`${statKey}-leaders`} className="mt-2 font-display text-2xl font-black uppercase text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold"><Icon size={20} /></span>
      </div>

      <ol className="mt-6 space-y-2">
        {entries.slice(0, 5).map((entry, index) => (
          <li key={entry.playerId} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-black/15 p-3">
            <span className="w-5 text-center font-display text-sm font-black text-slate-600">{index + 1}</span>
            <PlayerPhoto player={entry.player} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">{entry.player.name}</span>
              <span className="mt-0.5 block text-[10px] text-slate-500">#{entry.player.number} · {entry.player.role}</span>
            </span>
            <span className="font-display text-3xl font-black text-gold">{entry[statKey]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function Results() {
  const [competition, setCompetition] = useState('All')
  const [location, setLocation] = useState('All')

  const filteredResults = useMemo(() => results.filter((result) => {
    const competitionMatch = competition === 'All' || result.competition === competition
    const side = result.homeCode === 'BAR' ? 'Home' : 'Away'
    return competitionMatch && (location === 'All' || side === location)
  }), [competition, location])

  const groupedResults = useMemo(() => filteredResults.reduce((groups, result) => {
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${result.date}T12:00:00Z`))
    groups[month] ||= []
    groups[month].push(result)
    return groups
  }, {}), [filteredResults])

  const summaryCards = [
    { icon: Trophy, value: resultSummary.played, label: 'Played', note: 'Competitive matches' },
    { icon: BarChart3, value: `${resultSummary.wins}-${resultSummary.draws}-${resultSummary.losses}`, label: 'W–D–L', note: 'Perfect opening run' },
    { icon: Crosshair, value: resultSummary.goalsFor, label: 'Goals scored', note: `${(resultSummary.goalsFor / resultSummary.played).toFixed(1)} per match` },
    { icon: ShieldCheck, value: resultSummary.cleanSheets, label: 'Clean sheets', note: `${resultSummary.goalsAgainst} goals conceded` },
  ]

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Men’s first team · 2026/27"
        title="Final whistle. Full story."
        description="Every finished match, every scorer and every final pass from Barça’s competitive season so far."
      />

      <div className="page-shell">
        <div className="filter-panel">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><Filter size={14} className="text-gold" /> Competition</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {competitions.map((item) => <FilterChip key={item} selected={competition === item} onClick={() => setCompetition(item)}>{item}</FilterChip>)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><Trophy size={14} className="text-gold" /> Venue</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {locations.map((item) => <FilterChip key={item} selected={location === item} onClick={() => setLocation(item)}>{item}</FilterChip>)}
            </div>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Season results summary">
          {summaryCards.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="mini-stat min-h-36 items-start sm:min-h-0 sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><Icon size={18} /></span>
                <span>
                  <span className="block font-display text-3xl font-black text-white">{stat.value}</span>
                  <span className="block text-xs font-bold text-slate-300">{stat.label}</span>
                  <span className="mt-1 block text-[10px] text-slate-600">{stat.note}</span>
                </span>
              </div>
            )
          })}
        </section>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Leaderboard title="Top goalscorers" note="All competitive matches" entries={goalscorers} statKey="goals" icon={Crosshair} />
          <Leaderboard title="Assist providers" note="The final pass before the finish" entries={assistProviders} statKey="assists" icon={BarChart3} />
        </div>

        <section className="mt-12" aria-labelledby="player-stat-table">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The numbers</p>
              <h2 id="player-stat-table" className="section-title">Player stats</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">Through 13 Sep 2026</span>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/8 bg-panel">
            <div className="hidden grid-cols-[minmax(220px,1fr)_repeat(6,90px)] border-b border-white/8 px-6 py-4 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600 md:grid">
              <span>Player</span><span className="text-center">Apps</span><span className="text-center">Starts</span><span className="text-center">Minutes</span><span className="text-center">Goals</span><span className="text-center">Assists</span><span className="text-center">G+A</span>
            </div>
            <div className="divide-y divide-white/7">
              {statsWithPlayers.map((stat) => (
                <div key={stat.playerId} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(220px,1fr)_repeat(6,90px)] md:items-center md:gap-0 md:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerPhoto player={stat.player} size="md" />
                    <span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{stat.player.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">#{stat.player.number} · {stat.player.position}</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:contents">
                    {[
                      ['Apps', stat.appearances],
                      ['Starts', stat.starts],
                      ['Minutes', stat.minutes],
                      ['Goals', stat.goals],
                      ['Assists', stat.assists],
                      ['G+A', stat.goals + stat.assists],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-black/15 px-2 py-2 text-center md:bg-transparent md:p-0">
                        <span className="block text-[9px] font-bold uppercase text-slate-600 md:hidden">{label}</span>
                        <span className={`mt-1 block font-display text-lg font-black md:mt-0 ${label === 'G+A' ? 'text-gold' : 'text-slate-300'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-16 space-y-14">
          {Object.entries(groupedResults).map(([month, monthResults]) => (
            <section key={month} aria-labelledby={`results-${month}`}>
              <div className="mb-5 flex items-center gap-4">
                <h2 id={`results-${month}`} className="font-display text-3xl font-black uppercase tracking-tight text-white">{month}</h2>
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-xs font-bold text-slate-500">{monthResults.length} matches</span>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                {monthResults.map((result) => <ResultCard key={result.id} result={result} />)}
              </div>
            </section>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <div className="empty-state">
            <Trophy size={28} />
            <h2 className="mt-4 font-display text-2xl font-black uppercase">No results in this view</h2>
            <p className="mt-2 text-sm text-slate-400">Try a different competition or venue filter.</p>
          </div>
        )}

        <div className="data-note mt-12">
          <div>
            <p className="font-semibold text-slate-200">Results and player stats checked 16 September 2026</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Competitive first-team matches only. Assist attribution can vary slightly between data providers.</p>
          </div>
          <a href="https://www.fcbarcelona.com/en/futbol/primer-equip/resultats" target="_blank" rel="noreferrer" className="text-link shrink-0">
            Official results <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}
