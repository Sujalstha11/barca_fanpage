import { Trophy } from 'lucide-react'

export default function CompetitionPill({ competition }) {
  const champions = competition === 'Champions League'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${
        champions
          ? 'border-sky-400/25 bg-sky-400/10 text-sky-300'
          : 'border-gold/25 bg-gold/10 text-gold'
      }`}
    >
      <Trophy size={11} aria-hidden="true" />
      {competition}
    </span>
  )
}
