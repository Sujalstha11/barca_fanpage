import { useState } from 'react'
import { teams } from '../data/teams.js'

const teamStyles = {
  BAR: 'team-bar',
  RAC: 'bg-emerald-700 text-white',
  SEV: 'bg-white text-red-700',
  GET: 'bg-blue-600 text-white',
  GAL: 'bg-gradient-to-br from-red-700 to-amber-500 text-white',
  BET: 'bg-emerald-700 text-white',
  PSG: 'bg-[#101b45] text-white ring-1 ring-red-500/70',
  RMA: 'bg-white text-slate-800',
  AVL: 'bg-[#7a263a] text-[#95bfe5]',
  ATM: 'bg-gradient-to-r from-red-600 via-white to-red-600 text-[#1b3b75]',
  SAB: 'bg-sky-600 text-white',
  MCI: 'bg-[#6cabdd] text-white',
  ALA: 'bg-gradient-to-r from-blue-600 to-white text-slate-900',
}

export default function TeamBadge({ code, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  const team = teams[code]
  const showCrest = team?.crest && !failed
  const isLarge = size === 'lg'

  return (
    <span
      className={`grid shrink-0 place-items-center font-display font-black tracking-wide ${
        isLarge ? 'size-20 text-xl sm:size-24 sm:text-2xl' : 'size-12 text-[11px]'
      } ${
        showCrest
          ? ''
          : `overflow-hidden rounded-full p-2 shadow-lg ring-1 ring-white/15 ${teamStyles[code] || 'bg-slate-700 text-white'}`
      }`}
      aria-hidden="true"
    >
      {showCrest ? (
        <img
          src={team.crest}
          alt=""
          className={`block h-auto w-auto object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)] ${
            isLarge ? 'max-h-[90%] max-w-[90%]' : 'max-h-11 max-w-11'
          }`}
          onError={() => setFailed(true)}
        />
      ) : code}
    </span>
  )
}
