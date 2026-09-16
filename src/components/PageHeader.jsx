export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-shell pb-8 pt-12 sm:pb-10 sm:pt-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.035em] text-white sm:text-6xl">
            {title}
          </h1>
          {description && <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
