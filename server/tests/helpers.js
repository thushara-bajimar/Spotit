import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';

/** A fresh, fully migrated in-memory database for each test. */
export function createTestDb() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  return db;
}

let phoneCounter = 0;

/** Inserts a user row directly (auth logic arrives in Phase 2). */
export function insertUser(db, role, overrides = {}) {
  phoneCounter += 1;
  const phone = overrides.phone ?? `9${String(100000000 + phoneCounter).slice(-9)}`;
  const info = db
    .prepare(
      `INSERT INTO users (full_name, phone, password_hash, role)
       VALUES (@fullName, @phone, 'not-a-real-hash', @role)`,
    )
    .run({ fullName: overrides.fullName ?? `Test ${role}`, phone, role });
  return Number(info.lastInsertRowid);
}

/** Inserts a valid one-day job for the given employer. */
export function insertJob(db, employerId, overrides = {}) {
  const categoryId = db.prepare(`SELECT id FROM job_categories WHERE slug = 'cleaning'`).pluck().get();
  const job = {
    employerId,
    categoryId,
    title: 'Hostel cleaning help',
    description: 'Sweeping and mopping two hostel floors.',
    district: 'Dakshina Kannada',
    locality: 'Kankanady',
    startDate: '2026-12-12',
    endDate: null,
    startTime: '08:00',
    endTime: '16:00',
    durationType: 'one_day',
    wageAmount: 700,
    wageBasis: 'per_day',
    workersRequired: 2,
    ...overrides,
  };
  const info = db
    .prepare(
      `INSERT INTO jobs (employer_id, category_id, title, description, district, locality,
                         start_date, end_date, start_time, end_time, duration_type,
                         wage_amount, wage_basis, workers_required)
       VALUES (@employerId, @categoryId, @title, @description, @district, @locality,
               @startDate, @endDate, @startTime, @endTime, @durationType,
               @wageAmount, @wageBasis, @workersRequired)`,
    )
    .run(job);
  return Number(info.lastInsertRowid);
}
