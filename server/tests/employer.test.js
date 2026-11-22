import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb, daysFromToday, insertJob } from './helpers.js';

let db;
let app;

beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true, rateLimit: false });
});
afterEach(() => db.close());

let phoneSeq = 0;
const nextPhone = () => `9${String(500000000 + (phoneSeq += 1)).slice(-9)}`;

/** Registers an employer through the API; approves them unless told otherwise. */
async function employerAgent({ approved = true, ...overrides } = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/employer').send({
    fullName: 'Asha Shetty',
    phone: nextPhone(),
    password: 'employer1',
    employerType: 'hotel_restaurant',
    businessName: 'Sea View Hotel',
    district: 'udupi',
    locality: 'Malpe',
    ...overrides,
  });
  expect(res.status).toBe(201);
  agent.userId = res.body.user.id;
  if (approved) {
    db.prepare(`UPDATE employer_profiles SET verification_status = 'approved' WHERE user_id = ?`).run(agent.userId);
  }
  return agent;
}

async function workerAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/worker').send({
    fullName: 'Ravi Kumar',
    phone: nextPhone(),
    password: 'worker123',
    district: 'dakshina_kannada',
    locality: 'Kankanady',
    skills: ['cleaning'],
  });
  expect(res.status).toBe(201);
  agent.userId = res.body.user.id;
  return agent;
}

const validJob = (overrides = {}) => ({
  title: 'Kitchen helper for wedding',
  category: 'hotel_restaurant',
  description: 'Help the cooks with cutting vegetables and serving.',
  district: 'udupi',
  locality: 'Malpe',
  address: '12 Beach Road',
  startDate: daysFromToday(5),
  startTime: '07:00',
  endTime: '16:00',
  durationType: 'one_day',
  wageAmount: 700,
  wageBasis: 'per_day',
  workersRequired: 3,
  requirements: 'Clean clothes',
  ...overrides,
});

const approve = (jobId) =>
  db.prepare(`UPDATE jobs SET approval_status = 'approved', reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(jobId);

describe('employer authorization', () => {
  it('blocks anonymous users and workers from employer APIs', async () => {
    const worker = await workerAgent();
    for (const path of ['/api/employer/profile', '/api/employer/dashboard', '/api/employer/jobs', '/api/employer/applicants']) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await worker.get(path)).status).toBe(403);
    }
    expect((await worker.post('/api/employer/jobs').send(validJob())).status).toBe(403);
  });
});

describe('employer profile', () => {
  it('returns and updates the profile', async () => {
    const agent = await employerAgent();
    const res = await agent.put('/api/employer/profile').send({
      fullName: 'Asha S Shetty',
      employerType: 'hotel_restaurant',
      businessName: 'Sea View Hotel',
      district: 'udupi',
      locality: 'Kaup',
      address: 'Main road',
      description: 'Family run hotel.',
    });
    expect(res.status).toBe(200);
    expect(res.body.reviewRequired).toBe(false);
    expect(res.body.profile).toMatchObject({ fullName: 'Asha S Shetty', locality: 'Kaup', verificationStatus: 'approved' });
  });

  it('sends an approved employer back to review when the business identity changes', async () => {
    const agent = await employerAgent();
    const res = await agent.put('/api/employer/profile').send({
      fullName: 'Asha Shetty', employerType: 'shop', businessName: 'Asha Stores', district: 'udupi', locality: 'Malpe',
    });
    expect(res.body.reviewRequired).toBe(true);
    expect(res.body.profile.verificationStatus).toBe('pending');
  });

  it('re-submits a rejected employer for review on edit', async () => {
    const agent = await employerAgent({ approved: false });
    db.prepare(`UPDATE employer_profiles SET verification_status = 'rejected', rejection_reason = 'Name unclear' WHERE user_id = ?`).run(agent.userId);
    const res = await agent.put('/api/employer/profile').send({
      fullName: 'Asha Shetty', employerType: 'hotel_restaurant', businessName: 'Sea View Hotel Malpe', district: 'udupi', locality: 'Malpe',
    });
    expect(res.body.profile).toMatchObject({ verificationStatus: 'pending', rejectionReason: null });
  });

  it('validates profile fields (business name required for businesses)', async () => {
    const agent = await employerAgent();
    const res = await agent.put('/api/employer/profile').send({
      fullName: 'A', employerType: 'shop', businessName: '', district: 'nowhere', locality: 'Malpe',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['district', 'fullName']);
  });

  it('ignores attempts to self-approve through the profile', async () => {
    const agent = await employerAgent({ approved: false });
    const res = await agent.put('/api/employer/profile').send({
      fullName: 'Asha', employerType: 'household', district: 'udupi', locality: 'Malpe', verificationStatus: 'approved',
    });
    expect(res.body.profile.verificationStatus).toBe('pending');
  });
});

describe('posting jobs', () => {
  it('refuses employers that are not approved yet', async () => {
    const agent = await employerAgent({ approved: false });
    const res = await agent.post('/api/employer/jobs').send(validJob());
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'EMPLOYER_NOT_APPROVED', details: { verificationStatus: 'pending' } });
    expect(db.prepare('SELECT COUNT(*) FROM jobs').pluck().get()).toBe(0);
  });

  it('creates a job pending admin approval, hidden from workers', async () => {
    const agent = await employerAgent();
    const res = await agent.post('/api/employer/jobs').send(validJob());

    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({
      title: 'Kitchen helper for wedding',
      approvalStatus: 'pending',
      status: 'open',
      vacancies: 3,
      endDate: null,
      address: '12 Beach Road',
      canEdit: true,
      canClose: true,
    });

    const worker = await workerAgent();
    expect((await worker.get('/api/worker/jobs')).body.total).toBe(0);
    expect((await worker.get(`/api/worker/jobs/${res.body.job.id}`)).status).toBe(404);

    approve(res.body.job.id);
    expect((await worker.get('/api/worker/jobs')).body.total).toBe(1);
  });

  it('ignores attempts to self-approve a job', async () => {
    const agent = await employerAgent();
    const res = await agent.post('/api/employer/jobs').send({ ...validJob(), approvalStatus: 'approved', status: 'open' });
    expect(res.body.job.approvalStatus).toBe('pending');
  });

  it('validates every field', async () => {
    const agent = await employerAgent();
    const res = await agent.post('/api/employer/jobs').send({
      title: 'ab', category: 'flying', description: 'short', district: 'x', locality: '',
      startDate: '2026-02-30', startTime: '25:00', endTime: '7am', durationType: 'forever',
      wageAmount: 0, wageBasis: 'per_year', workersRequired: 500,
    });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual([
      'category', 'description', 'district', 'durationType', 'endTime', 'locality', 'startDate',
      'startTime', 'title', 'wageAmount', 'wageBasis', 'workersRequired',
    ]);
  });

  it.each([
    ['start date in the past', { startDate: daysFromToday(-1) }, 'startDate', 'date_in_past'],
    ['start date too far ahead', { startDate: daysFromToday(400) }, 'startDate', 'too_far_ahead'],
    ['multi-day without end date', { durationType: 'multiple_days' }, 'endDate', 'end_date_required'],
    ['end before start', { durationType: 'short_term', endDate: daysFromToday(2) }, 'endDate', 'end_before_start'],
    ['same start and end time', { startTime: '09:00', endTime: '09:00' }, 'endTime', 'same_time'],
  ])('rejects %s', async (_label, overrides, field, code) => {
    const agent = await employerAgent();
    const res = await agent.post('/api/employer/jobs').send(validJob(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, code }]);
  });

  it('drops the end date of single-day jobs and keeps it for multi-day jobs', async () => {
    const agent = await employerAgent();
    const single = await agent.post('/api/employer/jobs').send(validJob({ endDate: daysFromToday(9) }));
    expect(single.body.job.endDate).toBeNull();
    const multi = await agent
      .post('/api/employer/jobs')
      .send(validJob({ durationType: 'multiple_days', endDate: daysFromToday(8) }));
    expect(multi.body.job.endDate).toBe(daysFromToday(8));
  });

  it('the database refuses jobs from unapproved employers', async () => {
    const agent = await employerAgent({ approved: false });
    expect(() => insertJob(db, agent.userId)).toThrow(/not approved to post jobs/);
  });
});

describe('my jobs, details and dashboard', () => {
  it('lists only my own jobs, grouped, with live dashboard counts', async () => {
    const me = await employerAgent();
    const other = await employerAgent();
    const live = (await me.post('/api/employer/jobs').send(validJob({ title: 'Live job' }))).body.job.id;
    await me.post('/api/employer/jobs').send(validJob({ title: 'Waiting job' }));
    await other.post('/api/employer/jobs').send(validJob({ title: 'Not mine' }));
    approve(live);

    const all = await me.get('/api/employer/jobs');
    expect(all.body.jobs.map((j) => j.title).sort()).toEqual(['Live job', 'Waiting job']);
    expect((await me.get('/api/employer/jobs?group=live')).body.jobs.map((j) => j.title)).toEqual(['Live job']);
    expect((await me.get('/api/employer/jobs?group=pending')).body.jobs.map((j) => j.title)).toEqual(['Waiting job']);

    const worker = await workerAgent();
    await worker.post(`/api/worker/jobs/${live}/applications`).send({});

    const dash = await me.get('/api/employer/dashboard');
    expect(dash.body.stats).toEqual({
      totalJobs: 2, pendingApproval: 1, live: 1, rejected: 0, filled: 0, ended: 0, activeAssignments: 0, pendingApplicants: 1,
    });
    expect(dash.body.recentJobs).toHaveLength(2);
  });

  it("cannot view, edit or close another employer's job", async () => {
    const owner = await employerAgent();
    const intruder = await employerAgent();
    const jobId = (await owner.post('/api/employer/jobs').send(validJob())).body.job.id;

    expect((await intruder.get(`/api/employer/jobs/${jobId}`)).status).toBe(404);
    expect((await intruder.put(`/api/employer/jobs/${jobId}`).send(validJob({ title: 'Hijacked' }))).status).toBe(404);
    expect((await intruder.post(`/api/employer/jobs/${jobId}/close`).send({})).status).toBe(404);
    expect((await intruder.get(`/api/employer/applicants?jobId=${jobId}`)).status).toBe(404);
    expect(db.prepare('SELECT title, status FROM jobs WHERE id = ?').get(jobId)).toEqual({
      title: 'Kitchen helper for wedding',
      status: 'open',
    });
  });

  it('shows the rejection reason to the owner', async () => {
    const agent = await employerAgent();
    const jobId = (await agent.post('/api/employer/jobs').send(validJob())).body.job.id;
    db.prepare(`UPDATE jobs SET approval_status = 'rejected', rejection_reason = 'Wage unclear' WHERE id = ?`).run(jobId);
    const res = await agent.get(`/api/employer/jobs/${jobId}`);
    expect(res.body.job).toMatchObject({ approvalStatus: 'rejected', rejectionReason: 'Wage unclear' });
  });
});

describe('editing jobs', () => {
  async function approvedJob(agent, overrides) {
    const jobId = (await agent.post('/api/employer/jobs').send(validJob(overrides))).body.job.id;
    approve(jobId);
    return jobId;
  }

  it('sends an approved job back for review when important details change', async () => {
    const agent = await employerAgent();
    const jobId = await approvedJob(agent);
    const worker = await workerAgent();
    await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});

    const res = await agent.put(`/api/employer/jobs/${jobId}`).send(validJob({ wageAmount: 500 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reviewRequired: true, changedFields: ['wageAmount'] });
    expect(res.body.job.approvalStatus).toBe('pending');
    // Hidden from the marketplace until re-approved …
    expect((await worker.get('/api/worker/jobs')).body.total).toBe(0);
    // … and the applicant is told about the change.
    const note = db.prepare(`SELECT user_id, type, params FROM notifications WHERE type = 'job_updated'`).get();
    expect(note.user_id).toBe(worker.userId);
    expect(JSON.parse(note.params).changedFields).toEqual(['wageAmount']);
  });

  it('keeps approval when only the number of workers changes', async () => {
    const agent = await employerAgent();
    const jobId = await approvedJob(agent);
    const res = await agent.put(`/api/employer/jobs/${jobId}`).send(validJob({ workersRequired: 5 }));
    expect(res.body).toMatchObject({ reviewRequired: false, changedFields: ['workersRequired'] });
    expect(res.body.job).toMatchObject({ approvalStatus: 'approved', vacancies: 5 });
  });

  it('a rejected job edited by the employer is re-submitted', async () => {
    const agent = await employerAgent();
    const jobId = (await agent.post('/api/employer/jobs').send(validJob())).body.job.id;
    db.prepare(`UPDATE jobs SET approval_status = 'rejected', rejection_reason = 'Too vague' WHERE id = ?`).run(jobId);
    const res = await agent.put(`/api/employer/jobs/${jobId}`).send(validJob({ description: 'Clear description of the kitchen work.' }));
    expect(res.body.job).toMatchObject({ approvalStatus: 'pending', rejectionReason: null });
  });

  it('cannot reduce workers below those already assigned', async () => {
    const agent = await employerAgent();
    const jobId = await approvedJob(agent);
    db.prepare('UPDATE jobs SET workers_assigned = 2 WHERE id = ?').run(jobId);
    const res = await agent.put(`/api/employer/jobs/${jobId}`).send(validJob({ workersRequired: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'workersRequired', code: 'below_assigned' }]);
  });

  it('cannot edit closed or filled jobs', async () => {
    const agent = await employerAgent();
    const jobId = await approvedJob(agent);
    await agent.post(`/api/employer/jobs/${jobId}/close`).send({});
    const res = await agent.put(`/api/employer/jobs/${jobId}`).send(validJob({ title: 'Changed later' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('JOB_NOT_EDITABLE');
  });

  it('a job that already started can be edited without moving its start date', async () => {
    const agent = await employerAgent();
    const jobId = await approvedJob(agent, { durationType: 'short_term', endDate: daysFromToday(20) });
    db.prepare('UPDATE jobs SET start_date = ? WHERE id = ?').run(daysFromToday(-2), jobId);
    const res = await agent
      .put(`/api/employer/jobs/${jobId}`)
      .send(validJob({ durationType: 'short_term', startDate: daysFromToday(-2), endDate: daysFromToday(20), workersRequired: 4 }));
    expect(res.status).toBe(200);
  });
});

describe('closing jobs', () => {
  it('closes an open job, hides it and notifies pending applicants', async () => {
    const agent = await employerAgent();
    const jobId = (await agent.post('/api/employer/jobs').send(validJob())).body.job.id;
    approve(jobId);
    const worker = await workerAgent();
    await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});

    const res = await agent.post(`/api/employer/jobs/${jobId}/close`).send({ reason: 'Found enough helpers' });
    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({ status: 'closed', statusReason: 'Found enough helpers', canEdit: false, canClose: false });

    expect((await worker.get('/api/worker/jobs')).body.total).toBe(0);
    const details = await worker.get(`/api/worker/jobs/${jobId}`);
    expect(details.body.job.availability).toEqual({ canApply: false, reason: 'closed' });
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'job_closed'`).pluck().get()).toBe(1);

    const again = await agent.post(`/api/employer/jobs/${jobId}/close`).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('JOB_NOT_CLOSABLE');
  });

  it('the database refuses invalid lifecycle changes', async () => {
    const agent = await employerAgent();
    const jobId = (await agent.post('/api/employer/jobs').send(validJob())).body.job.id;
    await agent.post(`/api/employer/jobs/${jobId}/close`).send({});
    expect(() => db.prepare(`UPDATE jobs SET status = 'open' WHERE id = ?`).run(jobId)).toThrow(/invalid job status transition/);
  });
});

describe('applicants', () => {
  it('lists applicants for my jobs with profile details, phone hidden until accepted', async () => {
    const agent = await employerAgent();
    const jobId = (await agent.post('/api/employer/jobs').send(validJob())).body.job.id;
    approve(jobId);
    const worker = await workerAgent();
    await worker.post(`/api/worker/jobs/${jobId}/applications`).send({ message: 'I have hotel experience.' });

    const res = await agent.get(`/api/employer/applicants?jobId=${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.applicants).toHaveLength(1);
    expect(res.body.applicants[0]).toMatchObject({
      status: 'pending',
      message: 'I have hotel experience.',
      job: { id: jobId, title: 'Kitchen helper for wedding' },
      worker: {
        name: 'Ravi Kumar',
        district: { id: 'dakshina_kannada', nameEn: 'Dakshina Kannada' },
        locality: 'Kankanady',
        skills: ['cleaning'],
      },
    });
    // Phone is only shared after acceptance; passwords never.
    expect(res.body.applicants[0].worker.phone).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const job = await agent.get(`/api/employer/jobs/${jobId}`);
    expect(job.body.job.applicants).toEqual({ total: 1, pending: 1 });
  });

  it("does not show applicants of other employers' jobs", async () => {
    const owner = await employerAgent();
    const other = await employerAgent();
    const jobId = (await owner.post('/api/employer/jobs').send(validJob())).body.job.id;
    approve(jobId);
    await (await workerAgent()).post(`/api/worker/jobs/${jobId}/applications`).send({});

    expect((await other.get('/api/employer/applicants')).body.applicants).toEqual([]);
    expect((await owner.get('/api/employer/applicants')).body.applicants).toHaveLength(1);
  });
});
