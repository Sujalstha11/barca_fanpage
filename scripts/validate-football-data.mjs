import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { validateSnapshot } from './football-data/model.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = path.join(projectRoot, 'src', 'data', 'generated', 'snapshot.json')

try {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
  validateSnapshot(snapshot)
  console.log('Football data snapshot is valid.')
} catch (error) {
  console.error(`Football data validation failed: ${error.message}`)
  process.exitCode = 1
}
