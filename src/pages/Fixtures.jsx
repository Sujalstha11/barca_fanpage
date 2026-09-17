import { CalendarCheck2, ExternalLink, Filter, MapPinned } from 'lucide-react'
import { useMemo, useState } from 'react'
import FilterChip from '../components/FilterChip.jsx'
import FixtureCard from '../components/FixtureCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import TimezoneSelect from '../components/TimezoneSelect.jsx'
import { fixtureCompetitions, fixtures, fixturesCheckedAt, getTeamSide } from '../data/fixtures.js'
import { snapshotSeasonLabel } from '../data/snapshot.js'

const locations = ['All', 'Home', 'Away']

export default function Fixtures() {
  const [competition, setCompetition] = useState('All')
  const [location, setLocation] = useState('All')

  const filteredFixtures = useMemo(
    () => fixtures.filter((fixture) => {
      const competitionMatch = competition === 'All' || fixture.competition === competition
      const locationMatch = location === 'All' || getTeamSide(fixture) === location.toLowerCase()
      return competitionMatch && locationMatch
    }),
    [competition, location],
  )

  const groupedFixtures = useMemo(() => filteredFixtures.reduce((groups, fixture) => {
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${fixture.date}T12:00:00Z`))
    groups[month] ||= []
    groups[month].push(fixture)
    return groups
  }, {}), [filteredFixtures])

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow={`Men’s first team · ${snapshotSeasonLabel}`}
        title="Every date. Every kickoff."
        description="Confirmed match times automatically adjust to your chosen timezone. TBA means the league or competition has not locked the kickoff yet."
        action={<TimezoneSelect />}
      />

      <div className="page-shell">
        <div className="filter-panel">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><Filter size={14} className="text-gold" /> Competition</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {fixtureCompetitions.map((item) => <FilterChip key={item} selected={competition === item} onClick={() => setCompetition(item)}>{item}</FilterChip>)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><MapPinned size={14} className="text-gold" /> Venue</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {locations.map((item) => <FilterChip key={item} selected={location === item} onClick={() => setLocation(item)}>{item}</FilterChip>)}
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-14">
          {Object.entries(groupedFixtures).map(([month, monthFixtures]) => (
            <section key={month} aria-labelledby={`month-${month}`}>
              <div className="mb-5 flex items-center gap-4">
                <h2 id={`month-${month}`} className="font-display text-3xl font-black uppercase tracking-tight text-white">{month}</h2>
                <span className="h-px flex-1 bg-white/8" />
                <span className="text-xs font-bold text-slate-500">{monthFixtures.length} matches</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {monthFixtures.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} />)}
              </div>
            </section>
          ))}
        </div>

        {filteredFixtures.length === 0 && (
          <div className="empty-state">
            <CalendarCheck2 size={28} />
            <h2 className="mt-4 font-display text-2xl font-black uppercase">No matches in this view</h2>
            <p className="mt-2 text-sm text-slate-400">Try a different competition or venue filter.</p>
          </div>
        )}

        <div className="data-note mt-12">
          <div>
            <p className="font-semibold text-slate-200">Schedule checked {fixturesCheckedAt}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Times and venues can change. Always confirm close to matchday.</p>
          </div>
          <a href="https://www.fcbarcelona.com/en/futbol/primer-equipo/calendario" target="_blank" rel="noreferrer" className="text-link shrink-0">
            Official schedule <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}
