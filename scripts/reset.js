#!/usr/bin/env node
import {unlinkSync, existsSync} from 'node:fs'
import {config} from '../server/config.js'
import {db} from '../server/db.js'

const dbPath = config.DATABASE_PATH
if (dbPath !== ':memory:') {
  console.log(`Resetting database at ${dbPath}...`)
  try {
    db.close()
  } catch {}
  for (const ext of ['', '-wal', '-shm']) {
    const p = `${dbPath}${ext}`
    if (existsSync(p)) {
      unlinkSync(p)
      console.log(`Removed ${p}`)
    }
  }
}

// Re-open and migrate
const {db: freshDb} = await import('../server/db.js')
console.log('Database successfully reset and migrations applied.')
freshDb.close()
