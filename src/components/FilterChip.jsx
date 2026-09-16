export default function FilterChip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-10 rounded-xl border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        selected
          ? 'border-gold bg-gold text-ink shadow-[0_8px_25px_rgba(245,196,81,0.16)]'
          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
