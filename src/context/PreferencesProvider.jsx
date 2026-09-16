import { useMemo, useState } from 'react'
import { PreferencesContext } from './preferences.js'

const getLocalZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const DEFAULT_TIMEZONE = 'Asia/Kathmandu'
const TIMEZONE_STORAGE_KEY = 'culer-timezone-v2'

export default function PreferencesProvider({ children }) {
  const localZone = getLocalZone()
  const [timezone, setTimezone] = useState(() => localStorage.getItem(TIMEZONE_STORAGE_KEY) || DEFAULT_TIMEZONE)

  const value = useMemo(
    () => ({
      timezone,
      setTimezone: (nextZone) => {
        setTimezone(nextZone)
        localStorage.setItem(TIMEZONE_STORAGE_KEY, nextZone)
      },
      options: [
        { value: DEFAULT_TIMEZONE, label: 'Nepal time (NPT)' },
        { value: localZone, label: `My device (${localZone.split('/').at(-1).replaceAll('_', ' ')})` },
        { value: 'Europe/Madrid', label: 'Barcelona time' },
        { value: 'UTC', label: 'UTC' },
      ].filter((option, index, items) => items.findIndex((item) => item.value === option.value) === index),
    }),
    [timezone, localZone],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
