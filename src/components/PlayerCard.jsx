import { ArrowUpRight } from 'lucide-react'
import { getAge } from '../utils/formatters.js'
import PlayerPhoto from './PlayerPhoto.jsx'

const positionTone = {
  Goalkeeper: 'from-amber-400/30 to-amber-500/5 text-amber-300',
  Defender: 'from-sky-400/30 to-sky-500/5 text-sky-300',
  Midfielder: 'from-violet-400/30 to-violet-500/5 text-violet-300',
  Forward: 'from-rose-400/30 to-rose-500/5 text-rose-300',
}

export default function PlayerCard({ player }) {
  return (
    <article className="player-card group">
      <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${positionTone[player.position]}`} aria-hidden="true" />
      <span className="absolute right-4 top-1 font-display text-7xl font-black leading-none text-white/[0.07]" aria-hidden="true">
        {String(player.number).padStart(2, '0')}
      </span>

      <div className="relative flex items-start justify-between">
        <PlayerPhoto player={player} size="lg" />
        <span className="mt-2 grid size-8 place-items-center rounded-full border border-white/10 text-slate-500 transition group-hover:border-gold/40 group-hover:text-gold">
          <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </div>

      <div className="relative mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          #{player.number} · {player.role}
        </p>
        <h2 className="mt-2 font-display text-2xl font-black uppercase leading-none text-white">{player.name}</h2>
        <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs">
          <span className="text-slate-400">{player.flag} {player.nationality}</span>
          <span className="font-semibold text-slate-300">Age {getAge(player.birthDate)}</span>
        </div>
      </div>
    </article>
  )
}
