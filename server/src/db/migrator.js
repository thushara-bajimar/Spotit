import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Migration files are named NNN_description.sql and run in filename order.
const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

/**
 * Applies every migration that has not been applied yet.
 * Each file runs inside its own transaction together with the bookkeeping
 * insert, so a failing migration leaves the database unchanged.
 * Migration files must NOT contain BEGIN/COMMIT statements.
 *
 * @returns {string[]} the migration files applied during this call
 */
export function runMigrations(db, { directory = MIGRATIONS_DIR, log = () => {} } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
  `);

  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').pluck().all());
  const files = fs
    .readdirSync(directory)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();

  const recordMigration = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');
  const newlyApplied = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(directory, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      recordMigration.run(file);
    })();

    newlyApplied.push(file);
    log(`Applied migration ${file}`);
  }

  const violations = db.pragma('foreign_key_check');
  if (violations.length > 0) {
    throw new Error(`Foreign key violations found after migrating: ${JSON.stringify(violations)}`);
  }

  return newlyApplied;
}
