import { ArrowDown, ArrowUp, ArrowUpDown, Banknote, CalendarClock, CircleAlert, ExternalLink, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import FilterChip from '../components/FilterChip.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PlayerPhoto from '../components/PlayerPhoto.jsx'
import { players, positions } from '../data/players.js'
import { formatContractDate, formatMoney, getAge, getContractMeta } from '../utils/formatters.js'

const statusClasses = {
  urgent: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  watch: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  secure: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
}

function SalaryValue({ player, mode }) {
  if (player.annualSalary == null) return <span className="text-slate-500">Undisclosed</span>
  const value = mode === 'weekly' ? player.annualSalary / 52 : player.annualSalary
  return <>{formatMoney(value)}<span className="ml-1 text-[10px] font-medium text-slate-500">/{mode === 'weekly' ? 'wk' : 'yr'}</span></>
}

function SortButton({ label, sortKey, activeKey, direction, onSort }) {
  const Icon = activeKey !== sortKey ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 transition hover:text-white">
      {label} <Icon size={12} />
    </button>
  )
}

export default function Contracts() {
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('All')
  const [sort, setSort] = useState({ key: 'contractEnd', direction: 'asc' })
  const [salaryMode, setSalaryMode] = useState('annual')

  const rows = useMemo(() => {
    const filtered = players.filter((player) => {
      const matchesQuery = player.name.toLowerCase().includes(query.toLowerCase())
      return matchesQuery && (position === 'All' || player.position === position)
    })

    return [...filtered].sort((a, b) => {
      let first
      let second
      if (sort.key === 'name') { first = a.name; second = b.name }
      if (sort.key === 'age') { first = getAge(a.birthDate); second = getAge(b.birthDate) }
      if (sort.key === 'contractEnd') { first = a.contractEnd; second = b.contractEnd }
      if (sort.key === 'salary') { first = a.annualSalary ?? -1; second = b.annualSalary ?? -1 }
      const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [position, query, sort])

  const handleSort = (key) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  const disclosedPlayers = players.filter((player) => player.annualSalary != null)
  const totalPayroll = disclosedPlayers.reduce((sum, player) => sum + player.annualSalary, 0)
  const averageAge = (players.reduce((sum, player) => sum + getAge(player.birthDate), 0) / players.length).toFixed(1)
  const expiringSoon = players.filter((player) => getContractMeta(player.contractEnd).days <= 730).length

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Contract & salary tracker"
        title="How the squad is built."
        description="Reported contract dates, current ages, and estimated gross fixed salaries for the men’s first team."
      />

      <div className="page-shell">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Banknote, value: formatMoney(totalPayroll), label: 'Estimated disclosed payroll' },
            { icon: UsersRound, value: averageAge, label: 'Average squad age' },
            { icon: CalendarClock, value: expiringSoon, label: 'Deals within two years' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="contract-stat">
                <span className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold"><Icon size={19} /></span>
                <div><p className="font-display text-3xl font-black text-white">{stat.value}</p><p className="mt-1 text-xs text-slate-500">{stat.label}</p></div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm text-amber-100/80">
          <div className="flex items-start gap-3">
            <CircleAlert size={18} className="mt-0.5 shrink-0 text-gold" />
            <p className="leading-6"><strong className="text-amber-100">Salary estimates, not official payroll.</strong> Figures are reported gross base pay, exclude bonuses, and may vary by source. Two academy salaries are undisclosed.</p>
          </div>
        </div>

        <div className="filter-panel mt-6">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="contract-search" className="text-xs font-bold text-slate-300">Search contracts</label>
            <div className="relative mt-3">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input id="contract-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-11" placeholder="Player name…" />
            </div>
          </div>
          <div className="flex-[2]">
            <p className="text-xs font-bold text-slate-300">Position</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {positions.map((item) => <FilterChip key={item} selected={position === item} onClick={() => setPosition(item)}>{item}</FilterChip>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300">Salary view</p>
            <div className="mt-3 flex rounded-xl border border-white/10 bg-ink p-1">
              {['annual', 'weekly'].map((mode) => (
                <button key={mode} type="button" onClick={() => setSalaryMode(mode)} className={`min-h-8 rounded-lg px-3 text-xs font-bold capitalize ${salaryMode === mode ? 'bg-white text-ink' : 'text-slate-500 hover:text-white'}`}>{mode}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-white/8 bg-panel md:block">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/[0.025]">
              <tr>
                <th className="px-5 py-4"><SortButton label="Player" sortKey="name" activeKey={sort.key} direction={sort.direction} onSort={handleSort} /></th>
                <th className="px-4 py-4"><SortButton label="Age" sortKey="age" activeKey={sort.key} direction={sort.direction} onSort={handleSort} /></th>
                <th className="px-4 py-4"><SortButton label="Current deal" sortKey="contractEnd" activeKey={sort.key} direction={sort.direction} onSort={handleSort} /></th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">Remaining</th>
                <th className="px-5 py-4 text-right"><SortButton label="Estimated salary" sortKey="salary" activeKey={sort.key} direction={sort.direction} onSort={handleSort} /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => {
                const contract = getContractMeta(player.contractEnd)
                const progress = Math.min(100, (contract.days / (5 * 365)) * 100)
                return (
                  <tr key={player.id} className="border-t border-white/7 transition hover:bg-white/[0.025]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <PlayerPhoto player={player} size="sm" />
                        <div><p className="text-sm font-bold text-white">{player.name}</p><p className="mt-1 text-[10px] text-slate-500">#{player.number} · {player.role}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-300">{getAge(player.birthDate)}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-200">Until {formatContractDate(player.contractEnd)}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Signed {formatContractDate(player.contractSigned)}</p>
                    </td>
                    <td className="min-w-40 px-4 py-4">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-300">{contract.tenure}</span><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusClasses[contract.tone]}`}>{contract.label}</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full bg-gradient-to-r from-claret-light to-gold" style={{ width: `${progress}%` }} /></div>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-white"><SalaryValue player={player} mode={salaryMode} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 md:hidden">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <p className="shrink-0 text-xs text-slate-500">{rows.length} players</p>
            <select value={`${sort.key}:${sort.direction}`} onChange={(event) => { const [key, direction] = event.target.value.split(':'); setSort({ key, direction }) }} className="min-w-0 max-w-[68%] rounded-xl border border-white/10 bg-panel px-3 py-2 text-xs text-white">
              <option value="contractEnd:asc">Contract ending first</option>
              <option value="salary:desc">Highest salary</option>
              <option value="age:asc">Youngest first</option>
              <option value="name:asc">Name A–Z</option>
            </select>
          </div>
          {rows.map((player) => {
            const contract = getContractMeta(player.contractEnd)
            return (
              <article key={player.id} className="rounded-2xl border border-white/8 bg-panel p-5">
                <div className="flex items-start gap-3">
                  <PlayerPhoto player={player} size="sm" className="size-11" />
                  <div className="min-w-0"><h2 className="truncate font-display text-xl font-black uppercase">{player.name}</h2><p className="mt-1 text-xs text-slate-500">#{player.number} · {player.role} · Age {getAge(player.birthDate)}</p></div>
                  <span className={`ml-auto shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${statusClasses[contract.tone]}`}>{contract.label}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/8 pt-4">
                  <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Current deal</p><p className="mt-1 text-xs font-semibold text-slate-300">{formatContractDate(player.contractSigned)} → {formatContractDate(player.contractEnd)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Time remaining</p><p className="mt-1 text-xs font-semibold text-slate-300">{contract.tenure}</p></div>
                  <div className="col-span-2"><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Estimated gross salary</p><p className="mt-1 text-lg font-bold text-white"><SalaryValue player={player} mode={salaryMode} /></p></div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="data-note mt-10">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" />
            <div>
              <p className="font-semibold text-slate-200">Sources & methodology</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Contract dates: FC Barcelona announcements. Salary estimates: Capology via FBref, with SalaryLeaks estimates for selected newcomers. Checked 16 September 2026.</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-4">
            <a href="https://fbref.com/en/squads/206d90db/2026-2027/wages/Barcelona-Wage-Details" target="_blank" rel="noreferrer" className="text-link">Salary source <ExternalLink size={13} /></a>
            <a href="https://www.fcbarcelona.com/en/football/first-team/players" target="_blank" rel="noreferrer" className="text-link">Squad source <ExternalLink size={13} /></a>
          </div>
        </div>
      </div>
    </div>
  )
}
