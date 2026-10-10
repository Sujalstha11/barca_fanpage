import { writeFile } from 'node:fs/promises'
import { buildManualSnapshot } from './football-data/manual-2026-10-10.mjs'
import { validateSnapshot } from './football-data/model.mjs'

// Rebuilds the reviewed dataset locally. This command makes no network requests.
const snapshot = validateSnapshot(buildManualSnapshot())
await writeFile(new URL('../src/data/generated/snapshot.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`)
console.log('Rebuilt the public-source snapshot reviewed on 10 October 2026. No API key was used.')
