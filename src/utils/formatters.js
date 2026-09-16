export function formatFixtureDate(fixture, timezone, options = {}) {
  const date = fixture.kickoff ? new Date(fixture.kickoff) : new Date(`${fixture.date}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: options.short ? 'short' : 'long',
    day: 'numeric',
    month: options.short ? 'short' : 'long',
    ...(options.includeYear ? { year: 'numeric' } : {}),
    timeZone: fixture.kickoff ? timezone : 'UTC',
  }).format(date)
}

export function formatFixtureTime(fixture, timezone) {
  if (!fixture.kickoff) return 'TBA'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(fixture.kickoff))
}

export function getTimezoneLabel(timezone) {
  if (timezone === 'Europe/Madrid') return 'Barcelona time'
  if (timezone === 'Asia/Kathmandu' || timezone === 'Asia/Katmandu') return 'Nepal time · NPT'
  if (timezone === 'UTC') return 'UTC'
  return timezone.split('/').at(-1).replaceAll('_', ' ')
}

export function getAge(birthDate, referenceDate = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`)
  let age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDifference = referenceDate.getMonth() - birth.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birth.getDate())) age -= 1
  return age
}

export function formatMoney(value, compact = true) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatContractDate(contractEnd) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${contractEnd}T12:00:00Z`),
  )
}

export function getContractMeta(contractEnd, referenceDate = new Date()) {
  const end = new Date(`${contractEnd}T23:59:59`)
  const milliseconds = end - referenceDate
  const days = Math.max(0, Math.ceil(milliseconds / 86400000))
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const tenure = years > 0 ? `${years}y ${months}m` : `${months} months`

  if (days <= 365) return { label: 'Expiring soon', tone: 'urgent', tenure, days }
  if (days <= 730) return { label: 'Watchlist', tone: 'watch', tenure, days }
  return { label: 'Secured', tone: 'secure', tenure, days }
}

export function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}
