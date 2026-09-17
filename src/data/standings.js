import snapshot, { snapshotCheckedAt } from './snapshot.js'

function normalizeForm(form) {
  const results = Array.isArray(form) ? form : typeof form === 'string' ? form.split('') : []
  return results.map((result) => String(result).toUpperCase()).filter(Boolean)
}

export const standings = (Array.isArray(snapshot.standings) ? snapshot.standings : [])
  .map((standing) => ({
    ...standing,
    form: normalizeForm(standing.form),
  }))

export const standingsCheckedAt = snapshotCheckedAt
