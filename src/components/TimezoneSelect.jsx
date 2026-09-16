import { Clock3 } from 'lucide-react'
import { usePreferences } from '../context/preferences.js'

export default function TimezoneSelect({ dark = false }) {
  const { timezone, setTimezone, options } = usePreferences()

  return (
    <label
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm ${
        dark ? 'border-white/10 bg-ink/55 text-slate-200' : 'border-white/10 bg-panel text-slate-200'
      }`}
    >
      <Clock3 size={15} className="text-gold" aria-hidden="true" />
      <span className="sr-only">Display match times in</span>
      <select
        value={timezone}
        onChange={(event) => setTimezone(event.target.value)}
        className="max-w-48 cursor-pointer appearance-none bg-transparent pr-4 font-semibold outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-panel text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
