import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/connection.js';
import { MIGRATIONS_DIR, runMigrations } from '../src/db/migrator.js';
import { createTestDb, insertJob, insertUser } from './helpers.js';

const EXPECTED_TABLES = [
  'admin_actions', 'applications', 'assignments', 'employer_profiles', 'job_categories', 'jobs',
  'notifications', 'payments', 'reports', 'reviews', 'schema_migrations', 'sessions', 'users',
  'worker_profiles',
];

let db;
beforeEach(() => {
  db = createTestDb();
});
afterEach(() => db.close());

describe('migrations', () => {
  it('creates every core table', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .pluck()
      .all();
    expect(tables).toEqual(EXPECTED_TABLES);
  });

  it('enables foreign key enforcement', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('is idempotent: running again applies nothing', () => {
    expect(runMigrations(db)).toEqual([]);
    const recorded = db.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all();
    expect(recorded).toEqual(fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort());
  });

  it('rolls back a failing migration completely', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spotit-mig-'));
    fs.writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE a (id INTEGER PRIMARY KEY) STRICT;');
    fs.writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE b (id INTEGER) STRICT; THIS IS NOT SQL;');
    const fresh = openDatabase(':memory:');
    try {
      expect(() => runMigrations(fresh, { directory: dir })).toThrow();
      const tables = fresh.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).pluck().all();
      expect(tables).toContain('a');
      expect(tables).not.toContain('b');
      expect(fresh.prepare('SELECT version FROM schema_migrations').pluck().all()).toEqual(['001_ok.sql']);
    } finally {
      fresh.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('users constraints', () => {
  it('rejects duplicate phone numbers', () => {
    insertUser(db, 'worker', { phone: '9876543210' });
    expect(() => insertUser(db, 'employer', { phone: '9876543210' })).toThrow(/UNIQUE/);
  });

  it('rejects invalid phone numbers and roles', () => {
    expect(() => insertUser(db, 'worker', { phone: '12345' })).toThrow(/CHECK/);
    expect(() => insertUser(db, 'superuser')).toThrow(/CHECK/);
  });
});

describe('role integrity triggers', () => {
  it('only lets employers own jobs', () => {
    const worker = insertUser(db, 'worker');
    expect(() => insertJob(db, worker)).toThrow(/must reference an employer/);
  });

  it('only lets workers apply', () => {
    const employer = insertUser(db, 'employer');
    const jobId = insertJob(db, employer);
    expect(() =>
      db.prepare('INSERT INTO applications (job_id, worker_id) VALUES (?, ?)').run(jobId, employer),
    ).toThrow(/must reference a worker/);
  });

  it('matches profiles to roles', () => {
    const employer = insertUser(db, 'employer');
    expect(() => db.prepare('INSERT INTO worker_profiles (user_id) VALUES (?)').run(employer)).toThrow(
      /must reference a worker/,
    );
  });
});

describe('jobs constraints', () => {
  it('enforces foreign keys', () => {
    expect(() => insertJob(db, 99999)).toThrow();
  });

  it('never allows more workers assigned than required (overbooking guard)', () => {
    const employer = insertUser(db, 'employer');
    const jobId = insertJob(db, employer, { workersRequired: 2 });
    const assign = db.prepare('UPDATE jobs SET workers_assigned = ? WHERE id = ?');

    expect(() => assign.run(2, jobId)).not.toThrow();
    expect(() => assign.run(3, jobId)).toThrow(/CHECK/);
  });

  it('validates dates, times, wage and duration consistency', () => {
    const employer = insertUser(db, 'employer');
    expect(() => insertJob(db, employer, { startDate: '2026-02-30' })).toThrow(/CHECK/);
    expect(() => insertJob(db, employer, { startTime: '25:00' })).toThrow(/CHECK/);
    expect(() => insertJob(db, employer, { wageAmount: 0 })).toThrow(/CHECK/);
    expect(() => insertJob(db, employer, { wageBasis: 'whenever' })).toThrow(/CHECK/);
    // Multi-day jobs need an end date after the start date.
    expect(() => insertJob(db, employer, { durationType: 'multiple_days' })).toThrow(/CHECK/);
    expect(() =>
      insertJob(db, employer, { durationType: 'multiple_days', endDate: '2026-12-15' }),
    ).not.toThrow();
    // Night shifts may end "before" they start.
    expect(() => insertJob(db, employer, { startTime: '20:00', endTime: '06:00' })).not.toThrow();
  });

  it('requires a reason when a job is rejected', () => {
    const employer = insertUser(db, 'employer');
    const jobId = insertJob(db, employer);
    expect(() => db.prepare(`UPDATE jobs SET approval_status = 'rejected' WHERE id = ?`).run(jobId)).toThrow(
      /CHECK/,
    );
  });
});

describe('applications, assignments and reviews', () => {
  function setUpAcceptedApplication() {
    const employer = insertUser(db, 'employer');
    const worker = insertUser(db, 'worker');
    const jobId = insertJob(db, employer);
    const applicationId = Number(
      db.prepare('INSERT INTO applications (job_id, worker_id) VALUES (?, ?)').run(jobId, worker).lastInsertRowid,
    );
    return { employer, worker, jobId, applicationId };
  }

  it('prevents duplicate applications', () => {
    const { worker, jobId } = setUpAcceptedApplication();
    expect(() =>
      db.prepare('INSERT INTO applications (job_id, worker_id) VALUES (?, ?)').run(jobId, worker),
    ).toThrow(/UNIQUE/);
  });

  it('ties an assignment to its own application, job and worker', () => {
    const { employer, worker, jobId, applicationId } = setUpAcceptedApplication();
    const otherJob = insertJob(db, employer, { title: 'Another job' });
    const insertAssignment = db.prepare(
      'INSERT INTO assignments (job_id, worker_id, application_id) VALUES (?, ?, ?)',
    );

    expect(() => insertAssignment.run(otherJob, worker, applicationId)).toThrow(/FOREIGN KEY/);
    expect(() => insertAssignment.run(jobId, worker, applicationId)).not.toThrow();
  });

  it('allows reviews only after completion, once per reviewer', () => {
    const { employer, worker, jobId, applicationId } = setUpAcceptedApplication();
    const assignmentId = Number(
      db
        .prepare('INSERT INTO assignments (job_id, worker_id, application_id) VALUES (?, ?, ?)')
        .run(jobId, worker, applicationId).lastInsertRowid,
    );
    const review = db.prepare(
      'INSERT INTO reviews (assignment_id, reviewer_id, reviewee_id, rating) VALUES (?, ?, ?, ?)',
    );

    expect(() => review.run(assignmentId, employer, worker, 5)).toThrow(/completed assignment/);

    db.prepare(
      `UPDATE assignments SET status = 'completed', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(assignmentId);

    expect(() => review.run(assignmentId, employer, worker, 6)).toThrow(/CHECK/);
    expect(() => review.run(assignmentId, employer, worker, 5)).not.toThrow();
    expect(() => review.run(assignmentId, employer, worker, 4)).toThrow(/UNIQUE/);
    expect(() => review.run(assignmentId, worker, worker, 4)).toThrow(/CHECK/);
  });
});

describe('admin audit log', () => {
  it('is append-only and admin-only', () => {
    const admin = insertUser(db, 'admin');
    const worker = insertUser(db, 'worker');
    const insert = db.prepare(
      `INSERT INTO admin_actions (admin_id, action, target_type, target_id) VALUES (?, 'user.suspend', 'user', ?)`,
    );

    expect(() => insert.run(worker, worker)).toThrow(/must reference an admin/);
    const id = Number(insert.run(admin, worker).lastInsertRowid);

    expect(() => db.prepare(`UPDATE admin_actions SET reason = 'x' WHERE id = ?`).run(id)).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM admin_actions WHERE id = ?').run(id)).toThrow(/append-only/);
  });
});
