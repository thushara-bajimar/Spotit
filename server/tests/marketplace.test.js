import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb, daysFromToday, insertEmployer, insertJob } from './helpers.js';

let db;
let app;
let employerId;

beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true, rateLimit: false });
  employerId = insertEmployer(db);
});
afterEach(() => db.close());

let workerCount = 0;
async function workerAgent(overrides = {}) {
  workerCount += 1;
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/worker').send({
    fullName: overrides.fullName ?? 'Ravi Kumar',
    phone: overrides.phone ?? `8${String(100000000 + workerCount).slice(-9)}`,
    password: 'worker123',
    district: 'dakshina_kannada',
    locality: 'Kankanady',
  });
  expect(res.status).toBe(201);
  return agent;
}

const titles = (res) => res.body.jobs.map((j) => j.title).sort();

describe('GET /api/worker/jobs (marketplace)', () => {
  it('requires a signed-in worker', async () => {
    expect((await request(app).get('/api/worker/jobs')).status).toBe(401);

    const employer = request.agent(app);
    await employer.post('/api/auth/register/employer').send({
      fullName: 'Asha', phone: '9123456780', password: 'employer1',
      employerType: 'household', district: 'udupi', locality: 'Malpe',
    });
    expect((await employer.get('/api/worker/jobs')).status).toBe(403);
  });

  it('lists only approved, open, current jobs with free places from approved employers', async () => {
    insertJob(db, employerId, { title: 'Visible job' });
    insertJob(db, employerId, { title: 'Pending approval', approvalStatus: 'pending' });
    insertJob(db, employerId, { title: 'Rejected', approvalStatus: 'rejected' });
    insertJob(db, employerId, { title: 'Closed', status: 'closed' });
    insertJob(db, employerId, { title: 'Cancelled', status: 'cancelled' });
    insertJob(db, employerId, { title: 'Filled up', workersRequired: 2, workersAssigned: 2 });
    insertJob(db, employerId, { title: 'Yesterday', startDate: daysFromToday(-1) });
    insertJob(db, employerId, {
      title: 'Ongoing multi-day', durationType: 'multiple_days',
      startDate: daysFromToday(-2), endDate: daysFromToday(3),
    });
    // An employer sent back to review keeps their jobs, but they are hidden.
    const reReviewedEmployer = insertEmployer(db);
    insertJob(db, reReviewedEmployer, { title: 'Employer under review' });
    db.prepare(`UPDATE employer_profiles SET verification_status = 'pending' WHERE user_id = ?`).run(reReviewedEmployer);

    const res = await (await workerAgent()).get('/api/worker/jobs');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Ongoing multi-day', 'Visible job']);
    expect(res.body.total).toBe(2);
    // Past one-day jobs are marked expired in the database.
    expect(db.prepare(`SELECT status FROM jobs WHERE title = 'Yesterday'`).pluck().get()).toBe('expired');
  });

  it('returns card fields without private employer data', async () => {
    insertJob(db, employerId, { workersRequired: 3, workersAssigned: 1, address: '12 Secret Lane' });
    const res = await (await workerAgent()).get('/api/worker/jobs');
    const [job] = res.body.jobs;

    expect(job).toMatchObject({
      title: 'Hostel cleaning help',
      wageAmount: 700,
      wageBasis: 'per_day',
      durationType: 'one_day',
      startTime: '08:00',
      endTime: '16:00',
      workersRequired: 3,
      vacancies: 2,
      district: { id: 'dakshina_kannada', nameEn: 'Dakshina Kannada', nameKn: 'ದಕ್ಷಿಣ ಕನ್ನಡ' },
      category: { slug: 'cleaning', nameEn: 'Cleaning' },
      employer: { name: 'Sea View Hotel', type: 'hotel_restaurant', verified: true },
      myApplicationStatus: null,
    });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Secret Lane');
    expect(body).not.toMatch(/phone|password/i);
  });

  it('searches title, description, category (both languages) and treats % literally', async () => {
    insertJob(db, employerId, { title: 'Wedding kitchen helper', categorySlug: 'event_helper' });
    insertJob(db, employerId, { title: 'Night guard', description: 'Gate duty at the apartment.', categorySlug: 'watchman' });
    insertJob(db, employerId, { title: 'Garden upkeep', categorySlug: 'gardening' });
    const agent = await workerAgent();

    expect(titles(await agent.get('/api/worker/jobs?q=kitchen'))).toEqual(['Wedding kitchen helper']);
    expect(titles(await agent.get('/api/worker/jobs?q=gate'))).toEqual(['Night guard']);
    expect(titles(await agent.get('/api/worker/jobs?q=ತೋಟಗಾರಿಕೆ'))).toEqual(['Garden upkeep']);
    expect(titles(await agent.get('/api/worker/jobs?q=night%20apartment'))).toEqual(['Night guard']);
    expect((await agent.get('/api/worker/jobs?q=%25')).body.total).toBe(0);
  });

  it('filters by category, district, wage, duration and date', async () => {
    insertJob(db, employerId, { title: 'Job A', categorySlug: 'gardening', wageAmount: 500 });
    insertJob(db, employerId, { title: 'Job B', district: 'udupi', wageAmount: 900 });
    insertJob(db, employerId, { title: 'Job C', wageBasis: 'per_hour', wageAmount: 120 });
    insertJob(db, employerId, {
      title: 'Job D', durationType: 'multiple_days', startDate: daysFromToday(5), endDate: daysFromToday(8),
    });
    const agent = await workerAgent();
    const list = async (query) => titles(await agent.get(`/api/worker/jobs?${query}`));

    expect(await list('category=gardening')).toEqual(['Job A']);
    expect(await list('district=udupi')).toEqual(['Job B']);
    expect(await list('minWage=800')).toEqual(['Job B']);
    expect(await list('wageBasis=per_hour')).toEqual(['Job C']);
    expect(await list('duration=multiple_days')).toEqual(['Job D']);
    expect(await list(`date=${daysFromToday(6)}`)).toEqual(['Job D']);
  });

  it('sorts by wage and newest, and paginates', async () => {
    for (let i = 1; i <= 14; i += 1) insertJob(db, employerId, { title: `Job ${i}`, wageAmount: i * 100 });
    const agent = await workerAgent();

    const high = await agent.get('/api/worker/jobs?sort=wage_high');
    expect(high.body.jobs[0].wageAmount).toBe(1400);
    expect(high.body).toMatchObject({ total: 14, page: 1, pageSize: 12, totalPages: 2 });

    const low = await agent.get('/api/worker/jobs?sort=wage_low&page=2');
    expect(low.body.jobs.map((j) => j.wageAmount)).toEqual([1300, 1400]);

    const newest = await agent.get('/api/worker/jobs?sort=newest');
    expect(newest.body.jobs[0].title).toBe('Job 14');
  });

  it('rejects invalid filter values', async () => {
    const agent = await workerAgent();
    const res = await agent.get('/api/worker/jobs?category=flying&date=2026-02-30&minWage=-5&sort=random');
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['category', 'date', 'minWage', 'sort']);
  });
});

describe('GET /api/worker/jobs/:id (details)', () => {
  it('shows full details and availability, but no contact before acceptance', async () => {
    const jobId = insertJob(db, employerId, { requirements: 'Bring gloves', address: '12 Secret Lane' });
    const res = await (await workerAgent()).get(`/api/worker/jobs/${jobId}`);

    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({
      id: jobId,
      description: 'Sweeping and mopping two hostel floors.',
      requirements: 'Bring gloves',
      availability: { canApply: true, reason: null },
      myApplication: null,
      contact: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('Secret Lane');
  });

  it('explains why an approved job is unavailable', async () => {
    const jobId = insertJob(db, employerId, { status: 'filled', workersAssigned: 2 });
    const res = await (await workerAgent()).get(`/api/worker/jobs/${jobId}`);
    expect(res.body.job.availability).toEqual({ canApply: false, reason: 'filled' });
  });

  it('hides unapproved jobs and bad ids with 404', async () => {
    const pending = insertJob(db, employerId, { approvalStatus: 'pending' });
    const agent = await workerAgent();
    for (const path of [`/api/worker/jobs/${pending}`, '/api/worker/jobs/99999', '/api/worker/jobs/abc']) {
      const res = await agent.get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    }
  });

  it('shares the employer phone and address only after acceptance', async () => {
    const jobId = insertJob(db, employerId, { address: '12 Market Road' });
    const agent = await workerAgent();
    await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});
    db.prepare(`UPDATE applications SET status = 'accepted'`).run();

    const res = await agent.get(`/api/worker/jobs/${jobId}`);
    expect(res.body.job.contact).toEqual({ phone: expect.stringMatching(/^\d{10}$/), address: '12 Market Road' });
  });
});

describe('applying to jobs', () => {
  it('creates a pending application and notifies the employer', async () => {
    const jobId = insertJob(db, employerId);
    const agent = await workerAgent();
    const res = await agent.post(`/api/worker/jobs/${jobId}/applications`).send({ message: 'I can start at 8.' });

    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({ status: 'pending', message: 'I can start at 8.' });

    const notification = db.prepare('SELECT user_id, type, params FROM notifications').get();
    expect(notification).toMatchObject({ user_id: employerId, type: 'application_received' });
    expect(JSON.parse(notification.params)).toEqual({ jobTitle: 'Hostel cleaning help', workerName: 'Ravi Kumar' });

    const list = await agent.get('/api/worker/jobs');
    expect(list.body.jobs[0].myApplicationStatus).toBe('pending');
  });

  it('prevents duplicate applications', async () => {
    const jobId = insertJob(db, employerId);
    const agent = await workerAgent();
    await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});
    const again = await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});

    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'ALREADY_APPLIED', details: { status: 'pending' } });
    expect(db.prepare('SELECT COUNT(*) FROM applications').pluck().get()).toBe(1);
  });

  it.each([
    ['closed', { status: 'closed' }, 'closed'],
    ['cancelled', { status: 'cancelled' }, 'cancelled'],
    ['filled', { status: 'filled', workersAssigned: 2 }, 'filled'],
    ['no vacancies', { workersAssigned: 2 }, 'no_vacancies'],
    ['expired', { startDate: daysFromToday(-3) }, 'expired'],
  ])('refuses %s jobs', async (_label, overrides, reason) => {
    const jobId = insertJob(db, employerId, overrides);
    const res = await (await workerAgent()).post(`/api/worker/jobs/${jobId}/applications`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'JOB_UNAVAILABLE', details: { reason } });
    expect(db.prepare('SELECT COUNT(*) FROM applications').pluck().get()).toBe(0);
  });

  it('refuses rejected / unapproved jobs as not found', async () => {
    const rejected = insertJob(db, employerId, { approvalStatus: 'rejected' });
    const res = await (await workerAgent()).post(`/api/worker/jobs/${rejected}/applications`).send({});
    expect(res.status).toBe(404);
  });

  it('refuses jobs whose employer is suspended', async () => {
    const jobId = insertJob(db, employerId);
    db.prepare(
      `UPDATE users SET account_status = 'suspended', suspended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(employerId);
    const res = await (await workerAgent()).post(`/api/worker/jobs/${jobId}/applications`).send({});
    expect(res.status).toBe(404);
  });

  it('validates the optional message', async () => {
    const jobId = insertJob(db, employerId);
    const res = await (await workerAgent())
      .post(`/api/worker/jobs/${jobId}/applications`)
      .send({ message: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'message', code: 'too_long' }]);
  });

  it('the database itself refuses applications to unavailable jobs', () => {
    const jobId = insertJob(db, employerId, { status: 'closed' });
    const workerId = Number(
      db.prepare(`INSERT INTO users (full_name, phone, password_hash, role) VALUES ('Test Worker', '7000000001', 'x', 'worker')`)
        .run().lastInsertRowid,
    );
    expect(() =>
      db.prepare('INSERT INTO applications (job_id, worker_id) VALUES (?, ?)').run(jobId, workerId),
    ).toThrow(/not accepting applications/);
  });
});

describe('my applications and withdrawal', () => {
  it('lists only my applications with job details and counts', async () => {
    const jobA = insertJob(db, employerId, { title: 'Job A' });
    const jobB = insertJob(db, employerId, { title: 'Job B' });
    const me = await workerAgent();
    const someoneElse = await workerAgent({ fullName: 'Other Person' });
    await me.post(`/api/worker/jobs/${jobA}/applications`).send({});
    await me.post(`/api/worker/jobs/${jobB}/applications`).send({});
    await someoneElse.post(`/api/worker/jobs/${jobA}/applications`).send({});
    db.prepare(`UPDATE applications SET status = 'rejected' WHERE job_id = ? AND id = 2`).run(jobB);

    const res = await me.get('/api/worker/applications');
    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(2);
    expect(res.body.counts).toEqual({ pending: 1, accepted: 0, rejected: 1, withdrawn: 0 });
    expect(res.body.applications[0].job).toMatchObject({ title: expect.any(String), wageAmount: 700 });

    const pendingOnly = await me.get('/api/worker/applications?status=pending');
    expect(pendingOnly.body.applications.map((a) => a.job.title)).toEqual(['Job A']);
  });

  it('withdraws a pending application and allows applying again', async () => {
    const jobId = insertJob(db, employerId);
    const agent = await workerAgent();
    const { body } = await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});

    const out = await agent.post(`/api/worker/applications/${body.application.id}/withdraw`);
    expect(out.status).toBe(200);
    expect(out.body.application).toMatchObject({ status: 'withdrawn', withdrawnAt: expect.any(String) });

    const again = await agent.post(`/api/worker/applications/${body.application.id}/withdraw`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CANNOT_WITHDRAW');

    const details = await agent.get(`/api/worker/jobs/${jobId}`);
    expect(details.body.job.availability.canApply).toBe(true);

    const reapply = await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});
    expect(reapply.status).toBe(201);
    expect(reapply.body.application.status).toBe('pending');
    expect(db.prepare('SELECT COUNT(*) FROM applications').pluck().get()).toBe(1);
  });

  it('cannot withdraw accepted or rejected applications', async () => {
    const jobId = insertJob(db, employerId);
    const agent = await workerAgent();
    const { body } = await agent.post(`/api/worker/jobs/${jobId}/applications`).send({});
    db.prepare(`UPDATE applications SET status = 'accepted'`).run();

    const res = await agent.post(`/api/worker/applications/${body.application.id}/withdraw`);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ status: 'accepted' });
  });

  it("cannot see or withdraw another worker's application", async () => {
    const jobId = insertJob(db, employerId);
    const owner = await workerAgent();
    const intruder = await workerAgent({ fullName: 'Intruder' });
    const { body } = await owner.post(`/api/worker/jobs/${jobId}/applications`).send({});

    const res = await intruder.post(`/api/worker/applications/${body.application.id}/withdraw`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPLICATION_NOT_FOUND');
    expect((await intruder.get('/api/worker/applications')).body.applications).toEqual([]);
    expect(db.prepare('SELECT status FROM applications').pluck().get()).toBe('pending');
  });

  it('the database refuses invalid status changes', () => {
    const jobId = insertJob(db, employerId);
    const workerId = Number(
      db.prepare(`INSERT INTO users (full_name, phone, password_hash, role) VALUES ('Test Worker', '7000000002', 'x', 'worker')`)
        .run().lastInsertRowid,
    );
    db.prepare('INSERT INTO applications (job_id, worker_id) VALUES (?, ?)').run(jobId, workerId);
    db.prepare(`UPDATE applications SET status = 'rejected'`).run();
    expect(() => db.prepare(`UPDATE applications SET status = 'accepted'`).run()).toThrow(/invalid application status/);
    expect(() => db.prepare(`UPDATE applications SET status = 'pending'`).run()).toThrow(/invalid application status/);
  });
});
