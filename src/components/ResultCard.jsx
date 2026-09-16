import { MapPin } from 'lucide-react'
import CompetitionPill from './CompetitionPill.jsx'
import PlayerPhoto from './PlayerPhoto.jsx'
import TeamBadge from './TeamBadge.jsx'
import { players } from '../data/players.js'

const playerById = new Map(players.map((player) => [player.id, player]))

const goalTypeLabels = {
  penalty: 'PEN',
  'free-kick': 'FK',
  'own-goal': 'OG',
}

function formatResultDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function GoalEvent({ goal }) {
  const player = goal.scorerId ? playerById.get(goal.scorerId) : null
  const isBarcelona = goal.teamCode === 'BAR'
  const typeLabel = goalTypeLabels[goal.type]
  const detail = goal.assist ? `Assist · ${goal.assist}` : typeLabel === 'OG' ? 'Own goal' : 'Unassisted'

  return (
    <li className="flex min-h-14 items-center gap-3 rounded-xl border border-white/6 bg-black/15 px-3 py-2.5">
      <span className={`w-11 shrink-0 font-display text-lg font-black ${isBarcelona ? 'text-gold' : 'text-slate-400'}`}>
        {goal.minute}′
      </span>
      {player ? (
        <PlayerPhoto player={player} size="sm" />
      ) : (
        <span className={`grid size-9 shrink-0 place-items-center rounded-full text-[9px] font-black ${isBarcelona ? 'bg-gold text-ink' : 'bg-white/8 text-slate-300'}`}>
          {goal.teamCode}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-bold ${isBarcelona ? 'text-white' : 'text-slate-300'}`}>{goal.scorer}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">
          {detail}{typeLabel && typeLabel !== 'OG' ? ` · ${typeLabel}` : ''}
        </span>
      </span>
    </li>
  )
}

export default function ResultCard({ result }) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/9 bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <CompetitionPill competition={result.competition} />
          <time dateTime={result.date} className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
            {formatResultDate(result.date)}
          </time>
        </div>
        <span className="rounded-full bg-emerald-400/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">Full time · Win</span>
      </div>

      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7">
          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamBadge code={result.homeCode} size="lg" />
            <p className={`mt-3 truncate font-display text-base font-black uppercase sm:text-xl ${result.homeCode === 'BAR' ? 'text-white' : 'text-slate-300'}`}>{result.home}</p>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">Home</span>
          </div>

          <div className="text-center">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">FT</span>
            <p className="mt-2 whitespace-nowrap font-display text-5xl font-black leading-none text-white sm:text-7xl">
              {result.homeScore}<span className="mx-2 text-gold sm:mx-3">–</span>{result.awayScore}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center text-center">
            <TeamBadge code={result.awayCode} size="lg" />
            <p className={`mt-3 truncate font-display text-base font-black uppercase sm:text-xl ${result.awayCode === 'BAR' ? 'text-white' : 'text-slate-300'}`}>{result.away}</p>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">Away</span>
          </div>
        </div>

        <div className="mt-8 border-t border-white/8 pt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.13em] text-slate-300">Goal timeline</h3>
            <span className="text-[10px] text-slate-600">{result.goals.length} goals</span>
          </div>
          <ol className="grid gap-2 lg:grid-cols-2">
            {result.goals.map((goal, index) => <GoalEvent key={`${goal.teamCode}-${goal.minute}-${index}`} goal={goal} />)}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 bg-black/10 px-5 py-4 text-xs text-slate-500 sm:px-7">
        <MapPin size={14} className="text-claret-light" aria-hidden="true" />
        <span>{result.venue}</span>
        <span className="ml-auto">{result.round}</span>
      </div>
    </article>
  )
}
