import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAdminAccount } from '../src/modules/auth/auth.service.js';
import { createTestDb, daysFromToday, insertEmployer, insertJob } from './helpers.js';

let db;
let app;
beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true, rateLimit: false });
});
afterEach(() => db.close());

let phoneSeq = 0;
const nextPhone = () => `9${String(800000000 + (phoneSeq += 1)).slice(-9)}`;

async function adminAgent() {
  const phone = nextPhone();
  const id = await createAdminAccount(db, { fullName: 'Site Admin', phone, password: 'adminpass1' });
  const agent = request.agent(app);
  expect((await agent.post('/api/auth/login').send({ phone, password: 'adminpass1' })).status).toBe(200);
  agent.userId = id;
  return agent;
}

async function employerAgent({ approved = false } = {}) {
  const agent = request.agent(app);
  const phone = nextPhone();
  const res = await agent.post('/api/auth/register/employer').send({
    fullName: 'Asha Shetty', phone, password: 'employer1',
    employerType: 'shop', businessName: 'Asha Stores', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  agent.phone = phone;
  if (approved) db.prepare(`UPDATE employer_profiles SET verification_status = 'approved' WHERE user_id = ?`).run(agent.userId);
  return agent;
}

async function workerAgent(name = 'Ravi Kumar') {
  const agent = request.agent(app);
  const phone = nextPhone();
  const res = await agent.post('/api/auth/register/worker').send({
    fullName: name, phone, password: 'worker123', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  agent.phone = phone;
  return agent;
}

const validJob = (overrides = {}) => ({
  title: 'Shop helper for sale', category: 'shop_assistant', description: 'Arrange stock and help customers.',
  district: 'udupi', locality: 'Malpe', startDate: daysFromToday(3), startTime: '09:00', endTime: '18:00',
  durationType: 'one_day', wageAmount: 600, wageBasis: 'per_day', workersRequired: 2, ...overrides,
});

const auditCount = (action) => db.prepare('SELECT COUNT(*) FROM admin_actions WHERE action = ?').pluck().get(action);

/** worker + employer + completed assignment, for reviews/disputes. */
async function completedAssignment() {
  const employer = await employerAgent({ approved: true });
  const worker = await workerAgent();
  const jobId = insertJob(db, employer.userId, { startDate: daysFromToday(0) });
  const { body } = await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});
  const accepted = await employer.post(`/api/employer/jobs/${jobId}/applications/${body.application.id}/accept`);
  return { employer, worker, jobId, assignmentId: accepted.body.assignmentId };
}

describe('admin access', () => {
  it('only admins can use admin APIs (enforced by the server)', async () => {
    const worker = await workerAgent();
    const employer = await employerAgent({ approved: true });
    const paths = ['/api/admin/stats', '/api/admin/employers', '/api/admin/jobs', '/api/admin/users', '/api/admin/reports', '/api/admin/reviews', '/api/admin/disputes', '/api/admin/audit-log'];
    for (const path of paths) {
      expect((await request(app).get(path)).status, path).toBe(401);
      expect((await worker.get(path)).status, path).toBe(403);
      expect((await employer.get(path)).status, path).toBe(403);
    }
    expect((await employer.post(`/api/admin/employers/${employer.userId}/approve`).send({})).status).toBe(403);
    expect(db.prepare('SELECT verification_status FROM employer_profiles WHERE user_id = ?').pluck().get(employer.userId)).toBe('approved');
  });

  it('dashboard metrics come from the database', async () => {
    const admin = await adminAgent();
    await workerAgent();
    const approved = await employerAgent({ approved: true });
    await employerAgent();
    insertJob(db, approved.userId);
    insertJob(db, approved.userId, { approvalStatus: 'pending' });
    const res = await admin.get('/api/admin/stats');
    expect(res.body.stats).toMatchObject({ workers: 1, employers: 2, pendingEmployers: 1, pendingJobs: 1, activeJobs: 1, openReports: 0 });
  });
});

describe('employer approval', () => {
  it('approving lets the employer post jobs; the decision is audited and notified', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent();
    expect((await employer.post('/api/employer/jobs').send(validJob())).status).toBe(403);

    const pending = await admin.get('/api/admin/employers?status=pending');
    expect(pending.body.employers.map((e) => e.id)).toEqual([employer.userId]);
    expect(pending.body.employers[0]).toMatchObject({ businessName: 'Asha Stores', verificationStatus: 'pending', phone: employer.phone });

    const res = await admin.post(`/api/admin/employers/${employer.userId}/approve`).send({});
    expect(res.status).toBe(200);
    expect(res.body.employer.verificationStatus).toBe('approved');
    expect(res.body.employer.history[0]).toMatchObject({ action: 'employer.approve', adminName: 'Site Admin' });
    expect((await employer.post('/api/employer/jobs').send(validJob())).status).toBe(201);
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'employer_approved'`).pluck().get()).toBe(1);

    expect((await admin.post(`/api/admin/employers/${employer.userId}/approve`).send({})).body.error.code).toBe('ALREADY_DECIDED');
  });

  it('rejecting requires a reason, restricts the employer and shows them why', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent();
    expect((await admin.post(`/api/admin/employers/${employer.userId}/reject`).send({})).status).toBe(400);

    await admin.post(`/api/admin/employers/${employer.userId}/reject`).send({ reason: 'Business name could not be verified' });
    const me = await employer.get('/api/auth/me');
    expect(me.body.user.employer).toMatchObject({ verificationStatus: 'rejected', rejectionReason: 'Business name could not be verified' });
    expect((await employer.post('/api/employer/jobs').send(validJob())).status).toBe(403);
    expect(auditCount('employer.reject')).toBe(1);
  });

  it('revoking an approved employer hides their live jobs', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent({ approved: true });
    insertJob(db, employer.userId);
    const worker = await workerAgent();
    expect((await worker.get('/api/worker/jobs')).body.total).toBe(1);
    await admin.post(`/api/admin/employers/${employer.userId}/reject`).send({ reason: 'Complaints about unpaid wages' });
    expect((await worker.get('/api/worker/jobs')).body.total).toBe(0);
  });

  it('404 for unknown or non-employer ids', async () => {
    const admin = await adminAgent();
    const worker = await workerAgent();
    expect((await admin.get('/api/admin/employers/99999')).status).toBe(404);
    expect((await admin.post(`/api/admin/employers/${worker.userId}/approve`).send({})).status).toBe(404);
  });
});

describe('job approval', () => {
  it('approves pending jobs into the marketplace and rejects with a reason', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent({ approved: true });
    const worker = await workerAgent();
    const jobA = (await employer.post('/api/employer/jobs').send(validJob({ title: 'Job to approve' }))).body.job.id;
    const jobB = (await employer.post('/api/employer/jobs').send(validJob({ title: 'Job to reject' }))).body.job.id;

    const queue = await admin.get('/api/admin/jobs?approval=pending');
    expect(queue.body.jobs.map((j) => j.id).sort()).toEqual([jobA, jobB].sort());
    expect(queue.body.jobs[0].employer).toMatchObject({ name: 'Asha Stores', verificationStatus: 'approved' });

    await admin.post(`/api/admin/jobs/${jobA}/approve`).send({});
    expect((await worker.get('/api/worker/jobs')).body.jobs.map((j) => j.title)).toEqual(['Job to approve']);

    expect((await admin.post(`/api/admin/jobs/${jobB}/reject`).send({ reason: 'x' })).status).toBe(400); // too short
    await admin.post(`/api/admin/jobs/${jobB}/reject`).send({ reason: 'Wage seems unrealistic' });
    const own = await employer.get(`/api/employer/jobs/${jobB}`);
    expect(own.body.job).toMatchObject({ approvalStatus: 'rejected', rejectionReason: 'Wage seems unrealistic' });
    expect((await worker.get(`/api/worker/jobs/${jobB}`)).status).toBe(404);
    expect(auditCount('job.approve')).toBe(1);
    expect(auditCount('job.reject')).toBe(1);
  });

  it('flags jobs edited after approval as resubmitted, and re-approval publishes them again', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent({ approved: true });
    const jobId = (await employer.post('/api/employer/jobs').send(validJob())).body.job.id;
    await admin.post(`/api/admin/jobs/${jobId}/approve`).send({});
    await employer.put(`/api/employer/jobs/${jobId}`).send(validJob({ wageAmount: 400 }));

    const pending = await admin.get('/api/admin/jobs?approval=pending');
    expect(pending.body.jobs[0]).toMatchObject({ id: jobId, resubmitted: true, wageAmount: 400 });
    await admin.post(`/api/admin/jobs/${jobId}/approve`).send({});
    expect((await (await workerAgent()).get('/api/worker/jobs')).body.jobs[0].wageAmount).toBe(400);
  });

  it('cannot approve closed jobs or decide twice', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent({ approved: true });
    const jobId = (await employer.post('/api/employer/jobs').send(validJob())).body.job.id;
    await employer.post(`/api/employer/jobs/${jobId}/close`).send({});
    expect((await admin.post(`/api/admin/jobs/${jobId}/approve`).send({})).body.error.code).toBe('JOB_NOT_REVIEWABLE');
    await admin.post(`/api/admin/jobs/${jobId}/reject`).send({ reason: 'Closed anyway' });
    expect((await admin.post(`/api/admin/jobs/${jobId}/reject`).send({ reason: 'Again' })).body.error.code).toBe('ALREADY_DECIDED');
  });
});

describe('user management', () => {
  it('searches and filters users', async () => {
    const admin = await adminAgent();
    await workerAgent('Ravi Kumar');
    await workerAgent('Suma Poojary');
    await employerAgent();
    expect((await admin.get('/api/admin/users?role=worker')).body.total).toBe(2);
    expect((await admin.get('/api/admin/users?q=suma')).body.users.map((u) => u.fullName)).toEqual(['Suma Poojary']);
    expect((await admin.get('/api/admin/users?q=Asha%20Stores')).body.users[0].role).toBe('employer');
    expect((await admin.get('/api/admin/users?role=superuser')).status).toBe(400);
  });

  it('suspending logs the user out, blocks login and keeps all their records', async () => {
    const admin = await adminAgent();
    const { worker, assignmentId } = await completedAssignment();

    const res = await admin.post(`/api/admin/users/${worker.userId}/suspend`).send({ reason: 'Repeated no-shows' });
    expect(res.body.user).toMatchObject({ accountStatus: 'suspended', suspensionReason: 'Repeated no-shows' });
    expect((await worker.get('/api/worker/jobs')).status).toBe(401); // session ended
    const login = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: 'worker123' });
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
    // History preserved.
    expect(db.prepare('SELECT COUNT(*) FROM applications WHERE worker_id = ?').pluck().get(worker.userId)).toBe(1);
    expect(db.prepare('SELECT status FROM assignments WHERE id = ?').pluck().get(assignmentId)).toBe('confirmed');

    await admin.post(`/api/admin/users/${worker.userId}/reactivate`).send({});
    expect((await request(app).post('/api/auth/login').send({ phone: worker.phone, password: 'worker123' })).status).toBe(200);
    expect(auditCount('user.suspend')).toBe(1);
    expect(auditCount('user.reactivate')).toBe(1);
  });

  it("a suspended employer's jobs disappear and a suspended worker cannot be accepted", async () => {
    const admin = await adminAgent();
    const employer = await employerAgent({ approved: true });
    const jobId = insertJob(db, employer.userId);
    const worker = await workerAgent();
    const { body } = await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});

    await admin.post(`/api/admin/users/${worker.userId}/suspend`).send({ reason: 'Fake account' });
    const accept = await employer.post(`/api/employer/jobs/${jobId}/applications/${body.application.id}/accept`);
    expect(accept.body.error.code).toBe('WORKER_UNAVAILABLE');

    await admin.post(`/api/admin/users/${employer.userId}/suspend`).send({ reason: 'Fraud complaints' });
    expect((await (await workerAgent('Someone')).get('/api/worker/jobs')).body.total).toBe(0);
  });

  it('cannot suspend admins and needs a reason', async () => {
    const admin = await adminAgent();
    const worker = await workerAgent();
    expect((await admin.post(`/api/admin/users/${admin.userId}/suspend`).send({ reason: 'test' })).body.error.code).toBe('CANNOT_SUSPEND_ADMIN');
    expect((await admin.post(`/api/admin/users/${worker.userId}/suspend`).send({})).status).toBe(400);
  });

  it('shows user details with activity', async () => {
    const admin = await adminAgent();
    const { worker } = await completedAssignment();
    const res = await admin.get(`/api/admin/users/${worker.userId}`);
    expect(res.body.user).toMatchObject({ role: 'worker', activity: { applications: 1, activeAssignments: 1 } });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });
});

describe('reports', () => {
  function insertReport(reporterId, overrides = {}) {
    return Number(
      db.prepare(
        `INSERT INTO reports (reporter_id, category, description, reported_user_id, job_id)
         VALUES (@reporterId, @category, @description, @reportedUserId, @jobId)`,
      ).run({ reporterId, category: 'unpaid_wage', description: 'I was not paid for two days of work.', reportedUserId: null, jobId: null, ...overrides }).lastInsertRowid,
    );
  }

  it('moves a report through review to resolution with a note, notifying the reporter', async () => {
    const admin = await adminAgent();
    const { worker, employer, jobId } = await completedAssignment();
    const reportId = insertReport(worker.userId, { reportedUserId: employer.userId, jobId });

    const list = await admin.get('/api/admin/reports?status=pending');
    expect(list.body.reports[0]).toMatchObject({
      id: reportId, category: 'unpaid_wage', reporter: { name: 'Ravi Kumar' },
      reportedUser: { id: employer.userId, role: 'employer' }, job: { id: jobId },
    });

    expect((await admin.post(`/api/admin/reports/${reportId}/review`)).body.report.status).toBe('under_review');
    expect((await admin.post(`/api/admin/reports/${reportId}/resolve`).send({})).status).toBe(400);
    const done = await admin.post(`/api/admin/reports/${reportId}/resolve`).send({ note: 'Employer confirmed payment was made.' });
    expect(done.body.report).toMatchObject({ status: 'resolved', resolutionNote: 'Employer confirmed payment was made.', resolvedByName: 'Site Admin' });
    expect(db.prepare(`SELECT user_id FROM notifications WHERE type = 'report_resolved'`).pluck().get()).toBe(worker.userId);
    expect((await admin.post(`/api/admin/reports/${reportId}/dismiss`).send({ note: 'again' })).body.error.code).toBe('REPORT_ALREADY_CLOSED');
    expect(auditCount('report.review') + auditCount('report.resolve')).toBe(2);
  });

  it('dismisses with a note, and the database refuses reopening', async () => {
    const admin = await adminAgent();
    const worker = await workerAgent();
    const reportId = insertReport(worker.userId, { category: 'other', description: 'Something about the site is confusing.' });
    await admin.post(`/api/admin/reports/${reportId}/dismiss`).send({ note: 'Not a policy issue.' });
    expect(() => db.prepare(`UPDATE reports SET status = 'pending' WHERE id = ?`).run(reportId)).toThrow(/invalid report status/);
  });
});

describe('review moderation', () => {
  async function reviewed() {
    const ctx = await completedAssignment();
    const { employer, worker, assignmentId } = ctx;
    await employer.post(`/api/employer/assignments/${assignmentId}/start`);
    await worker.post(`/api/worker/assignments/${assignmentId}/complete`);
    await employer.post(`/api/employer/assignments/${assignmentId}/complete`);
    const reviewId = Number(
      db.prepare('INSERT INTO reviews (assignment_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, 1, ?)')
        .run(assignmentId, employer.userId, worker.userId, 'Rude and abusive words here').lastInsertRowid,
    );
    db.prepare(`INSERT INTO reports (reporter_id, category, description, review_id) VALUES (?, 'harassment', 'This review is abusive.', ?)`)
      .run(worker.userId, reviewId);
    return { ...ctx, reviewId };
  }

  it('hides and restores reviews with reasons and audit records', async () => {
    const admin = await adminAgent();
    const { worker, reviewId } = await reviewed();

    const reported = await admin.get('/api/admin/reviews?reported=1');
    expect(reported.body.reviews[0]).toMatchObject({ id: reviewId, rating: 1, openReportCount: 1, moderationStatus: 'visible' });

    expect((await admin.post(`/api/admin/reviews/${reviewId}/hide`).send({})).status).toBe(400);
    await admin.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Abusive language' });
    expect(db.prepare('SELECT moderation_status, moderation_note, rating FROM reviews WHERE id = ?').get(reviewId)).toEqual({
      moderation_status: 'hidden', moderation_note: 'Abusive language', rating: 1,
    });
    // Hidden reviews do not count towards the user's rating.
    expect((await admin.get(`/api/admin/users/${worker.userId}`)).body.user.rating).toEqual({ average: null, count: 0 });

    await admin.post(`/api/admin/reviews/${reviewId}/restore`).send({ reason: 'Reviewed again, acceptable' });
    expect(auditCount('review.hide')).toBe(1);
    expect(auditCount('review.restore')).toBe(1);
  });

  it('there is no admin endpoint to create or edit ratings', async () => {
    const admin = await adminAgent();
    const { reviewId } = await reviewed();
    expect((await admin.post('/api/admin/reviews').send({ rating: 5 })).status).toBe(404);
    expect((await admin.put(`/api/admin/reviews/${reviewId}`).send({ rating: 5 })).status).toBe(404);
  });
});

describe('disputes', () => {
  it('admin resolves a dispute; both parties are notified', async () => {
    const admin = await adminAgent();
    const { employer, worker, assignmentId } = await completedAssignment();
    await employer.post(`/api/employer/assignments/${assignmentId}/start`);
    await worker.post(`/api/worker/assignments/${assignmentId}/dispute`).send({ reason: 'Hours were longer than agreed' });

    const list = await admin.get('/api/admin/disputes');
    expect(list.body.disputes[0]).toMatchObject({ id: assignmentId, disputedBy: 'worker', disputeReason: 'Hours were longer than agreed' });

    expect((await admin.post(`/api/admin/disputes/${assignmentId}/resolve`).send({ outcome: 'paid', note: 'x x x' })).status).toBe(400);
    await admin.post(`/api/admin/disputes/${assignmentId}/resolve`).send({ outcome: 'completed', note: 'Both sides agreed after a call.' });
    const view = await worker.get(`/api/worker/assignments/${assignmentId}`);
    expect(view.body.assignment.status).toBe('completed');
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'dispute_resolved'`).pluck().get()).toBe(2);
    expect((await admin.post(`/api/admin/disputes/${assignmentId}/resolve`).send({ outcome: 'cancelled', note: 'again' })).body.error.code).toBe('NOT_DISPUTED');
  });

  it('cancelling a dispute shows "admin" as who cancelled and frees the place', async () => {
    const admin = await adminAgent();
    const { employer, worker, jobId, assignmentId } = await completedAssignment();
    await employer.post(`/api/employer/assignments/${assignmentId}/start`);
    await employer.post(`/api/employer/assignments/${assignmentId}/dispute`).send({ reason: 'Worker never came' });
    await admin.post(`/api/admin/disputes/${assignmentId}/resolve`).send({ outcome: 'cancelled', note: 'Worker confirmed they could not come.' });
    const view = await worker.get(`/api/worker/assignments/${assignmentId}`);
    expect(view.body.assignment).toMatchObject({ status: 'cancelled', cancelledBy: 'admin' });
    expect(db.prepare('SELECT workers_assigned FROM jobs WHERE id = ?').pluck().get(jobId)).toBe(0);
  });
});

describe('audit log', () => {
  it('lists decisions newest first, filterable, and cannot be altered', async () => {
    const admin = await adminAgent();
    const employer = await employerAgent();
    await admin.post(`/api/admin/employers/${employer.userId}/reject`).send({ reason: 'Incomplete details' });
    await admin.post(`/api/admin/employers/${employer.userId}/approve`).send({});

    const log = await admin.get('/api/admin/audit-log');
    expect(log.body.entries.map((e) => e.action)).toEqual(['employer.approve', 'employer.reject']);
    expect(log.body.entries[1]).toMatchObject({ adminName: 'Site Admin', targetType: 'employer', targetId: employer.userId, reason: 'Incomplete details' });
    expect((await admin.get('/api/admin/audit-log?action=employer.reject')).body.total).toBe(1);
    expect((await admin.get('/api/admin/audit-log?targetType=job')).body.total).toBe(0);
    expect(() => db.prepare('DELETE FROM admin_actions').run()).toThrow(/append-only/);
  });
});
