import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, readFileSync, readdirSync, unlinkSync, existsSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {config} from './config.js';

const dbPath = config.DATABASE_PATH;
if (dbPath !== ':memory:') {
  mkdirSync(dirname(resolve(dbPath)), {recursive: true});
}

export const db = new DatabaseSync(dbPath);

export const transaction = fn => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = fn();
    db.exec('COMMIT');
    return value;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

/**
 * Runs all numbered .sql migration files in order.
 */
export function runMigrations(database = db) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = resolve(import.meta.dirname, 'migrations');
  let migrationFiles = [];
  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    // If running in alternate directory structure
    const fallbackDir = resolve(process.cwd(), 'server', 'migrations');
    if (existsSync(fallbackDir)) {
      migrationFiles = readdirSync(fallbackDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    }
  }

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map(r => r.version)
  );

  for (const file of migrationFiles) {
    if (!applied.has(file)) {
      let filePath = resolve(migrationsDir, file);
      if (!existsSync(filePath)) {
        filePath = resolve(process.cwd(), 'server', 'migrations', file);
      }
      const sql = readFileSync(filePath, 'utf-8');
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec(sql);
        database
          .prepare('INSERT INTO schema_migrations (version) VALUES (?)')
          .run(file);
        database.exec('COMMIT');
      } catch (err) {
        database.exec('ROLLBACK');
        throw new Error(`Failed to apply migration ${file}: ${err.message}`);
      }
    }
  }

  // Ensure dynamic columns exist for backward-compatibility if tables were created earlier
  const itemCols = new Set(
    database.prepare('PRAGMA table_info(items)').all().map(c => c.name)
  );
  if (!itemCols.has('latitude')) database.exec('ALTER TABLE items ADD COLUMN latitude REAL');
  if (!itemCols.has('longitude')) database.exec('ALTER TABLE items ADD COLUMN longitude REAL');
  if (!itemCols.has('photo_key')) database.exec('ALTER TABLE items ADD COLUMN photo_key TEXT');
  if (!itemCols.has('expected_answer')) {
    database.exec('ALTER TABLE items ADD COLUMN expected_answer TEXT');
  }

  const claimCols = new Set(
    database.prepare('PRAGMA table_info(claims)').all().map(c => c.name)
  );
  if (!claimCols.has('proof_photo_key')) {
    database.exec('ALTER TABLE claims ADD COLUMN proof_photo_key TEXT');
  }
  if (!claimCols.has('meetup_status')) {
    database.exec(
      "ALTER TABLE claims ADD COLUMN meetup_status TEXT DEFAULT 'proposed'"
    );
  }
  if (!claimCols.has('meetup_proposer_id')) {
    database.exec('ALTER TABLE claims ADD COLUMN meetup_proposer_id TEXT');
  }
  if (!claimCols.has('review_note')) {
    database.exec('ALTER TABLE claims ADD COLUMN review_note TEXT');
  }
}

// Automatically run migrations on db startup
runMigrations(db);

/**
 * Resets database completely (used by scripts/reset.js).
 */
export function resetDatabase() {
  if (dbPath === ':memory:') {
    runMigrations(db);
    return;
  }
  try {
    db.close();
  } catch {}
  for (const ext of ['', '-wal', '-shm']) {
    const p = `${dbPath}${ext}`;
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {}
    }
  }
}
