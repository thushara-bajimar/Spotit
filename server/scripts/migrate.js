// Applies pending database migrations: `npm run db:migrate`
import { config } from '../src/config/env.js';
import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';

const db = openDatabase(config.databasePath);
try {
  const applied = runMigrations(db, { log: console.log });
  console.log(
    applied.length === 0
      ? `Database is up to date (${config.databasePath}).`
      : `Applied ${applied.length} migration(s) to ${config.databasePath}.`,
  );
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
