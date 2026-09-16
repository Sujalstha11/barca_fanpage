export default function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-3" aria-label="Culer Collective">
      <span className="grid size-11 shrink-0 place-items-center" aria-hidden="true">
        <img src="/crests/bar.svg" alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.35)]" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-black uppercase tracking-[0.1em] text-white">Culer</span>
          <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.28em] text-gold">Collective</span>
        </span>
      )}
    </div>
  )
}
