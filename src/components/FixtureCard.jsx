import { MapPin } from 'lucide-react'
import { usePreferences } from '../context/preferences.js'
import { formatFixtureDate, formatFixtureTime, getTimezoneLabel } from '../utils/formatters.js'
import CompetitionPill from './CompetitionPill.jsx'
import TeamBadge from './TeamBadge.jsx'

export default function FixtureCard({ fixture, compact = false }) {
  const { timezone } = usePreferences()

  return (
    <article className="fixture-card group">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CompetitionPill competition={fixture.competition} />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.11em] text-slate-400">
            {formatFixtureDate(fixture, timezone, { short: compact, includeYear: false })}
          </p>
        </div>
        <div className="text-right">
          <time
            dateTime={fixture.kickoff || fixture.date}
            className={`block font-display font-black leading-none text-white ${compact ? 'text-3xl' : 'text-4xl'}`}
          >
            {formatFixtureTime(fixture, timezone)}
          </time>
          <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {fixture.confirmed ? getTimezoneLabel(timezone) : 'Time to be confirmed'}
          </span>
        </div>
      </div>

      <div className="my-6 grid gap-3">
        <div className="flex items-center gap-3">
          <TeamBadge code={fixture.homeCode} />
          <span className={`font-display text-xl font-bold uppercase ${fixture.homeCode === 'BAR' ? 'text-white' : 'text-slate-300'}`}>
            {fixture.home}
          </span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-600">Home</span>
        </div>
        <div className="flex items-center gap-3">
          <TeamBadge code={fixture.awayCode} />
          <span className={`font-display text-xl font-bold uppercase ${fixture.awayCode === 'BAR' ? 'text-white' : 'text-slate-300'}`}>
            {fixture.away}
          </span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-600">Away</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 pt-4 text-xs text-slate-400">
        <MapPin size={14} className="text-claret-light" aria-hidden="true" />
        <span className="truncate">{fixture.venue}</span>
        <span className="ml-auto shrink-0 text-slate-500">{fixture.round}</span>
      </div>
    </article>
  )
}
