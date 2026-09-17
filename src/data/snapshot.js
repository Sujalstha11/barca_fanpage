import snapshotData from './generated/snapshot.json'

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function toValidDate(value, dateOnly = false) {
  if (!value) return null
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSnapshotDate(value) {
  const date = toValidDate(value)
  return date ? longDateFormatter.format(date) : 'date unavailable'
}

export function formatSnapshotMatchDate(value) {
  const date = toValidDate(value, true)
  return date ? shortDateFormatter.format(date) : null
}

export const snapshot = snapshotData
export const snapshotGeneratedAt = snapshot.generatedAt ?? null
export const snapshotCheckedAt = formatSnapshotDate(snapshotGeneratedAt)
const snapshotSeasonStart = Number(snapshot.source?.season)
export const snapshotSeasonLabel = Number.isInteger(snapshotSeasonStart)
  ? `${snapshotSeasonStart}/${String(snapshotSeasonStart + 1).slice(-2)}`
  : 'Current'

export default snapshot
