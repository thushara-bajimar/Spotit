import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Opens a SQLite database with the settings every SpotIt connection must use.
 * Pass ':memory:' for an isolated in-memory database (used by tests).
 */
export function openDatabase(filename) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);

  // Foreign keys are OFF by default in SQLite and must be enabled per connection.
  db.pragma('foreign_keys = ON');
  // WAL gives better concurrency between reads and writes.
  db.pragma('journal_mode = WAL');
  // Wait briefly instead of failing immediately if the database is locked.
  db.pragma('busy_timeout = 5000');

  if (db.pragma('foreign_keys', { simple: true }) !== 1) {
    db.close();
    throw new Error('SQLite foreign key enforcement could not be enabled.');
  }

  return db;
}
