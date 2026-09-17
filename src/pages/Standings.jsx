import { ArrowUpRight, ExternalLink, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react'
import CompetitionPill from '../components/CompetitionPill.jsx'
import PageHeader from '../components/PageHeader.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import { standings, standingsCheckedAt } from '../data/standings.js'
import { snapshotSeasonLabel } from '../data/snapshot.js'

const recordStats = [
  ['Played', 'played'],
  ['Won', 'wins'],
  ['Drawn', 'draws'],
  ['Lost', 'losses'],
]

const goalStats = [
  ['Goals for', 'goalsFor'],
  ['Goals against', 'goalsAgainst'],
  ['Goal difference', 'goalDifference'],
]

const formMeta = {
  W: { label: 'win', className: 'bg-emerald-300 text-emerald-950' },
  D: { label: 'draw', className: 'bg-amber-300 text-amber-950' },
  L: { label: 'loss', className: 'bg-rose-400 text-rose-950' },
}

function getFormMeta(result) {
  return formMeta[result] || { label: 'result unavailable', className: 'bg-white/8 text-slate-300' }
}

function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : value
}

function StandingCard({ standing }) {
  const isChampionsLeague = standing.competition === 'Champions League'

  return (
    <article
      className="overflow-hidden rounded-3xl border border-white/8 bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      aria-labelledby={`${standing.id}-standing`}
    >
      <div className={`h-1.5 ${isChampionsLeague ? 'bg-gradient-to-r from-sky-500 via-blue-400 to-indigo-500' : 'bg-gradient-to-r from-claret via-gold to-barca-blue'}`} />

      <div className="border-b border-white/8 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CompetitionPill competition={standing.competition} />
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{standing.stage}</span>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="flex min-w-0 items-center gap-4">
            <TeamBadge code="BAR" size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold">{standing.season} season</p>
              <h2 id={`${standing.id}-standing`} className="mt-2 truncate font-display text-3xl font-black uppercase leading-none text-white sm:text-4xl">
                Barcelona
              </h2>
              <p className="mt-2 text-xs font-semibold text-slate-500">{standing.competition} standing</p>
            </div>
          </div>

          <div className="flex items-end gap-2 border-t border-white/8 pt-5 sm:block sm:border-0 sm:pt-0 sm:text-right">
            <span className="font-display text-7xl font-black leading-[0.72] tracking-[-0.05em] text-white">{standing.positionLabel}</span>
            <span className="pb-1 text-xs font-bold uppercase tracking-wider text-slate-500 sm:mt-3 sm:block sm:pb-0">of {standing.totalTeams} teams</span>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/15 to-gold/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gold">Points</span>
              <Trophy size={17} className="text-gold" aria-hidden="true" />
            </div>
            <p className="mt-5 font-display text-6xl font-black leading-none text-white">{standing.points}</p>
            <p className="mt-2 text-xs text-slate-400">From {standing.played} {standing.played === 1 ? 'match' : 'matches'}</p>
          </div>

          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
                <ArrowUpRight size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-200">{standing.standingLabel}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-100/55">{standing.standingNote}</p>
              </div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-gold"
                style={{ width: `${Math.max(14, ((standing.totalTeams - standing.position + 1) / standing.totalTeams) * 100)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <section className="mt-7" aria-label={`${standing.competition} match record`}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-gold" aria-hidden="true" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Season record</h3>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recordStats.map(([label, key]) => (
              <div key={key} className="rounded-xl border border-white/6 bg-black/15 px-3 py-3 text-center">
                <dt className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-black text-white">{standing[key]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-7" aria-label={`${standing.competition} goal record`}>
          <div className="mb-3 flex items-center gap-2">
            <Target size={15} className="text-claret-light" aria-hidden="true" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Goal record</h3>
          </div>
          <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/7 bg-black/10">
            {goalStats.map(([label, key], index) => (
              <div key={key} className={`px-2 py-4 text-center ${index > 0 ? 'border-l border-white/7' : ''}`}>
                <dt className="text-[8px] font-black uppercase tracking-wide text-slate-600 sm:text-[9px]">{label}</dt>
                <dd className={`mt-2 font-display text-2xl font-black ${key === 'goalDifference' ? 'text-gold' : 'text-slate-200'}`}>
                  {key === 'goalDifference' ? formatGoalDifference(standing[key]) : standing[key]}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-7 flex flex-col gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Recent form</p>
            {standing.form.length > 0 ? (
              <ol className="mt-2 flex gap-1.5" aria-label={`${standing.competition} recent form: ${standing.form.map((result) => getFormMeta(result).label).join(', ')}`}>
                {standing.form.map((result, index) => {
                  const resultMeta = getFormMeta(result)
                  return (
                    <li key={`${result}-${index}`} className={`grid size-8 place-items-center rounded-lg text-xs font-black ${resultMeta.className}`}>
                      <span className="sr-only">Match {index + 1}: {resultMeta.label}</span>
                      <span aria-hidden="true">{result || '—'}</span>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No recent form recorded</p>
            )}
          </div>
          <a href={standing.sourceUrl} target="_blank" rel="noreferrer" className="text-link shrink-0">
            {standing.sourceLabel} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  )
}

export default function Standings() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow={`Men’s first team · ${snapshotSeasonLabel}`}
        title="Every table. One clear picture."
        description="Barça’s live position across every active league competition, with form, points, and the numbers behind each standing."
      />

      <div className="page-shell">
        <div className="grid gap-5 xl:grid-cols-2">
          {standings.map((standing) => <StandingCard key={standing.id} standing={standing} />)}
        </div>

        <div className="data-note mt-10">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-200">Standings checked {standingsCheckedAt}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">League tables can change after every match. Positions and qualification zones reflect the latest completed fixtures.</p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Official competition data</span>
        </div>
      </div>
    </div>
  )
}
