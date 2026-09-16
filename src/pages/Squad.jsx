import { Search, Shield, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import FilterChip from '../components/FilterChip.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PlayerCard from '../components/PlayerCard.jsx'
import { players, positions } from '../data/players.js'
import { getAge } from '../utils/formatters.js'

export default function Squad() {
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('All')

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const matchesQuery = `${player.name} ${player.role} ${player.nationality}`.toLowerCase().includes(query.toLowerCase())
    const matchesPosition = position === 'All' || player.position === position
    return matchesQuery && matchesPosition
  }), [query, position])

  const averageAge = (players.reduce((sum, player) => sum + getAge(player.birthDate), 0) / players.length).toFixed(1)
  const nationalities = new Set(players.map((player) => player.nationality)).size

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Official first-team list"
        title="The players behind the shirt."
        description="Explore the 2026/27 men’s first team by position, role, nationality, and squad number."
      />

      <div className="page-shell">
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { value: players.length, label: 'Players registered' },
            { value: averageAge, label: 'Average age' },
            { value: nationalities, label: 'Nationalities' },
          ].map((stat) => (
            <div key={stat.label} className="mini-stat">
              <span className="font-display text-3xl font-black text-white">{stat.value}</span>
              <span className="text-xs font-semibold text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="filter-panel items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="player-search" className="text-xs font-bold text-slate-300">Find a player</label>
            <div className="relative mt-3">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="player-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, role, or nationality…"
                className="input-field pl-11 pr-11"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-300">Position</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {positions.map((item) => <FilterChip key={item} selected={position === item} onClick={() => setPosition(item)}>{item}</FilterChip>)}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Showing {filteredPlayers.length} of {players.length}</p>
          <p className="hidden text-xs text-slate-600 sm:block">Ages calculated today</p>
        </div>

        {filteredPlayers.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlayers.map((player) => <PlayerCard key={player.id} player={player} />)}
          </div>
        ) : (
          <div className="empty-state">
            <UsersRound size={28} />
            <h2 className="mt-4 font-display text-2xl font-black uppercase">No player found</h2>
            <p className="mt-2 text-sm text-slate-400">Clear your search or choose another position.</p>
            <button type="button" className="button-secondary mt-5" onClick={() => { setQuery(''); setPosition('All') }}>Reset filters</button>
          </div>
        )}

        <div className="data-note mt-12">
          <div className="flex items-start gap-3">
            <Shield size={18} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="font-semibold text-slate-200">Squad data from the club’s first-team list</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Roster checked 16 September 2026. Registration can change during the season.</p>
            </div>
          </div>
          <a href="https://www.fcbarcelona.com/en/football/first-team/players" target="_blank" rel="noreferrer" className="text-link shrink-0">View source</a>
        </div>
      </div>
    </div>
  )
}
