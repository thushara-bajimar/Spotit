import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';
import { todayInIndia } from '../src/utils/dates.js';

/** A fresh, fully migrated in-memory database for each test. */
export function createTestDb() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  return db;
}

/** 'YYYY-MM-DD' this many days from today (in India). Keeps tests valid over time. */
export function daysFromToday(days) {
  const [y, m, d] = todayInIndia().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

let phoneCounter = 0;

/** Inserts a user row directly (bypassing the auth API). */
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

/** Inserts an employer user with a profile (approved unless stated otherwise). */
export function insertEmployer(db, overrides = {}) {
  const employerId = insertUser(db, 'employer', overrides);
  db.prepare(
    `INSERT INTO employer_profiles (user_id, employer_type, business_name, district, locality, verification_status)
     VALUES (?, ?, ?, 'dakshina_kannada', 'Hampankatta', ?)`,
  ).run(
    employerId,
    overrides.employerType ?? 'hotel_restaurant',
    overrides.businessName === undefined ? 'Sea View Hotel' : overrides.businessName,
    overrides.verificationStatus ?? 'approved',
  );
  return employerId;
}

/** Inserts a valid one-day job (approved and open by default) for the given employer. */
export function insertJob(db, employerId, overrides = {}) {
  const categoryId = db
    .prepare('SELECT id FROM job_categories WHERE slug = ?')
    .pluck()
    .get(overrides.categorySlug ?? 'cleaning');
  const job = {
    employerId,
    categoryId,
    title: 'Hostel cleaning help',
    description: 'Sweeping and mopping two hostel floors.',
    district: 'dakshina_kannada',
    locality: 'Kankanady',
    startDate: daysFromToday(20),
    endDate: null,
    startTime: '08:00',
    endTime: '16:00',
    durationType: 'one_day',
    wageAmount: 700,
    wageBasis: 'per_day',
    workersRequired: 2,
    workersAssigned: 0,
    approvalStatus: 'approved',
    status: 'open',
    requirements: null,
    address: null,
    ...overrides,
  };
  delete job.categorySlug;
  const info = db
    .prepare(
      `INSERT INTO jobs (employer_id, category_id, title, description, district, locality, address,
                         start_date, end_date, start_time, end_time, duration_type,
                         wage_amount, wage_basis, workers_required, workers_assigned,
                         approval_status, rejection_reason, status, requirements)
       VALUES (@employerId, @categoryId, @title, @description, @district, @locality, @address,
               @startDate, @endDate, @startTime, @endTime, @durationType,
               @wageAmount, @wageBasis, @workersRequired, @workersAssigned,
               @approvalStatus, @rejectionReason, @status, @requirements)`,
    )
    .run({ rejectionReason: job.approvalStatus === 'rejected' ? 'Not suitable' : null, ...job });
  return Number(info.lastInsertRowid);
}
