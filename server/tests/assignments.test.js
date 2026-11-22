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
const nextPhone = () => `9${String(700000000 + (phoneSeq += 1)).slice(-9)}`;

async function employerAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/employer').send({
    fullName: 'Asha Shetty', phone: nextPhone(), password: 'employer1',
    employerType: 'hotel_restaurant', businessName: 'Sea View Hotel', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  agent.phone = res.body.user.phone;
  db.prepare(`UPDATE employer_profiles SET verification_status = 'approved' WHERE user_id = ?`).run(agent.userId);
  return agent;
}

async function workerAgent(name = 'Ravi Kumar') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/worker').send({
    fullName: name, phone: nextPhone(), password: 'worker123', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  agent.phone = res.body.user.phone;
  return agent;
}

/** An approved open job owned by `employer` (inserted directly; started today unless stated). */
const jobFor = (employer, overrides = {}) =>
  insertJob(db, employer.userId, { startDate: daysFromToday(0), workersRequired: 2, ...overrides });

async function apply(worker, jobId) {
  const res = await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});
  expect(res.status).toBe(201);
  return res.body.application.id;
}

const accept = (employer, jobId, applicationId) =>
  employer.post(`/api/employer/jobs/${jobId}/applications/${applicationId}/accept`);
const reject = (employer, jobId, applicationId) =>
  employer.post(`/api/employer/jobs/${jobId}/applications/${applicationId}/reject`);
const jobRow = (jobId) => db.prepare('SELECT status, workers_assigned AS assigned FROM jobs WHERE id = ?').get(jobId);

describe('accepting applications', () => {
  it('accepts, creates assignment + payment, notifies the worker and shares contacts', async () => {
    const employer = await employerAgent();
    const worker = await workerAgent();
    const jobId = jobFor(employer, { wageAmount: 750, address: '12 Beach Road' });
    const applicationId = await apply(worker, jobId);

    const res = await accept(employer, jobId, applicationId);
    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({ workersAssigned: 1, vacancies: 1, status: 'open', confirmedWorkers: 1 });

    expect(db.prepare('SELECT status FROM applications WHERE id = ?').pluck().get(applicationId)).toBe('accepted');
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(res.body.assignmentId);
    expect(assignment).toMatchObject({ status: 'confirmed', job_id: jobId, worker_id: worker.userId, application_id: applicationId });
    expect(db.prepare('SELECT agreed_amount, wage_basis, status FROM payments WHERE assignment_id = ?').get(assignment.id)).toEqual({
      agreed_amount: 750, wage_basis: 'per_day', status: 'pending',
    });
    expect(db.prepare(`SELECT user_id FROM notifications WHERE type = 'application_accepted'`).pluck().get()).toBe(worker.userId);

    // Both sides now see each other's phone number.
    const applicants = await employer.get(`/api/employer/applicants?jobId=${jobId}`);
    expect(applicants.body.applicants[0].worker.phone).toBe(worker.phone);
    const details = await worker.get(`/api/worker/jobs/${jobId}`);
    expect(details.body.job.contact).toEqual({ phone: employer.phone, address: '12 Beach Road' });
    expect(details.body.job.myApplication.assignmentId).toBe(res.body.assignmentId);
  });

  it('marks the job filled when capacity is reached and refuses further acceptance', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer, { workersRequired: 2 });
    const apps = [];
    for (const name of ['Worker One', 'Worker Two', 'Worker Three']) apps.push(await apply(await workerAgent(name), jobId));

    expect((await accept(employer, jobId, apps[0])).status).toBe(201);
    expect(jobRow(jobId)).toEqual({ status: 'open', assigned: 1 });
    expect((await accept(employer, jobId, apps[1])).status).toBe(201);
    expect(jobRow(jobId)).toEqual({ status: 'filled', assigned: 2 });

    const third = await accept(employer, jobId, apps[2]);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('NO_VACANCIES');
    expect(db.prepare('SELECT status FROM applications WHERE id = ?').pluck().get(apps[2])).toBe('pending');
    expect(db.prepare('SELECT COUNT(*) FROM assignments').pluck().get()).toBe(2);
    // Filled jobs disappear from the marketplace.
    expect((await (await workerAgent('Late Comer')).get('/api/worker/jobs')).body.total).toBe(0);
  });

  it('cannot overbook even when acceptances arrive at the same time', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer, { workersRequired: 1 });
    const apps = [];
    for (const name of ['Fast One', 'Fast Two', 'Fast Three']) apps.push(await apply(await workerAgent(name), jobId));

    const results = await Promise.all(apps.map((id) => accept(employer, jobId, id)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(jobRow(jobId)).toEqual({ status: 'filled', assigned: 1 });
    expect(db.prepare(`SELECT COUNT(*) FROM applications WHERE status = 'accepted'`).pluck().get()).toBe(1);
  });

  it('the database itself refuses one assignment too many', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer, { workersRequired: 1 });
    const a1 = await apply(await workerAgent('One'), jobId);
    const a2 = await apply(await workerAgent('Two'), jobId);
    await accept(employer, jobId, a1);
    // Bypass the service: force the second application to accepted and insert an assignment.
    db.prepare(`UPDATE jobs SET status = 'open' WHERE id = ?`).run(jobId);
    db.prepare(`UPDATE applications SET status = 'accepted' WHERE id = ?`).run(a2);
    const worker2 = db.prepare('SELECT worker_id FROM applications WHERE id = ?').pluck().get(a2);
    expect(() =>
      db.prepare('INSERT INTO assignments (job_id, worker_id, application_id) VALUES (?, ?, ?)').run(jobId, worker2, a2),
    ).toThrow(/CHECK/);
  });

  it('refuses already-decided, withdrawn and duplicate decisions', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer);
    const worker = await workerAgent();
    const applicationId = await apply(worker, jobId);

    expect((await accept(employer, jobId, applicationId)).status).toBe(201);
    const again = await accept(employer, jobId, applicationId);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'APPLICATION_NOT_PENDING', details: { status: 'accepted' } });
    expect((await reject(employer, jobId, applicationId)).status).toBe(409);
    expect(db.prepare('SELECT COUNT(*) FROM assignments').pluck().get()).toBe(1);

    const other = await workerAgent('Withdrawer');
    const withdrawnId = await apply(other, jobId);
    await other.post(`/api/worker/applications/${withdrawnId}/withdraw`);
    expect((await accept(employer, jobId, withdrawnId)).body.error.code).toBe('APPLICATION_NOT_PENDING');
  });

  it('refuses acceptance for closed, unapproved or past jobs', async () => {
    const employer = await employerAgent();
    const worker = await workerAgent();
    const jobId = jobFor(employer);
    const applicationId = await apply(worker, jobId);
    await employer.post(`/api/employer/jobs/${jobId}/close`).send({});
    const res = await accept(employer, jobId, applicationId);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'JOB_UNAVAILABLE', details: { reason: 'closed' } });
    expect(db.prepare('SELECT COUNT(*) FROM assignments').pluck().get()).toBe(0);

    const job2 = jobFor(employer);
    const app2 = await apply(worker, job2);
    db.prepare(`UPDATE jobs SET approval_status = 'pending' WHERE id = ?`).run(job2);
    expect((await accept(employer, job2, app2)).body.error.details.reason).toBe('not_approved');
  });

  it('only lets the owning employer decide, and checks the application belongs to the job', async () => {
    const owner = await employerAgent();
    const intruder = await employerAgent();
    const worker = await workerAgent();
    const jobA = jobFor(owner);
    const jobB = jobFor(owner, { title: 'Second job' });
    const applicationId = await apply(worker, jobA);

    expect((await accept(intruder, jobA, applicationId)).status).toBe(404);
    expect((await reject(intruder, jobA, applicationId)).status).toBe(404);
    // Right owner, wrong job in the URL.
    const mismatch = await accept(owner, jobB, applicationId);
    expect(mismatch.status).toBe(404);
    expect(mismatch.body.error.code).toBe('APPLICATION_NOT_FOUND');
    // Workers cannot reach the endpoint at all.
    expect((await worker.post(`/api/employer/jobs/${jobA}/applications/${applicationId}/accept`)).status).toBe(403);
    expect(db.prepare('SELECT status FROM applications WHERE id = ?').pluck().get(applicationId)).toBe('pending');
  });

  it('rejecting creates no assignment and notifies the worker', async () => {
    const employer = await employerAgent();
    const worker = await workerAgent();
    const jobId = jobFor(employer);
    const applicationId = await apply(worker, jobId);
    const res = await reject(employer, jobId, applicationId);
    expect(res.status).toBe(200);
    expect(db.prepare('SELECT status FROM applications WHERE id = ?').pluck().get(applicationId)).toBe('rejected');
    expect(db.prepare('SELECT COUNT(*) FROM assignments').pluck().get()).toBe(0);
    expect(jobRow(jobId).assigned).toBe(0);
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'application_rejected'`).pluck().get()).toBe(1);
  });
});

describe('assignments', () => {
  async function confirmedAssignment(jobOverrides = {}) {
    const employer = await employerAgent();
    const worker = await workerAgent();
    const jobId = jobFor(employer, jobOverrides);
    const applicationId = await apply(worker, jobId);
    const { body } = await accept(employer, jobId, applicationId);
    return { employer, worker, jobId, id: body.assignmentId };
  }
  const act = (agent, role, id, action, reason) =>
    agent.post(`/api/${role}/assignments/${id}/${action}`).send(reason ? { reason } : {});

  it('both sides see the assignment with the right details', async () => {
    const { employer, worker, id } = await confirmedAssignment({ wageAmount: 800 });

    const mine = await worker.get('/api/worker/assignments');
    expect(mine.body.assignments).toHaveLength(1);
    expect(mine.body.assignments[0]).toMatchObject({
      id, status: 'confirmed',
      payment: { agreedAmount: 800, wageBasis: 'per_day', status: 'pending' },
      employer: { name: 'Sea View Hotel', phone: employer.phone },
      actions: ['complete', 'cancel'],
    });
    expect(mine.body.assignments[0].worker).toBeUndefined();

    const theirs = await employer.get(`/api/employer/assignments/${id}`);
    expect(theirs.body.assignment).toMatchObject({
      worker: { name: 'Ravi Kumar', phone: worker.phone },
      actions: ['start', 'complete', 'cancel'],
    });
  });

  it('runs the full lifecycle: start → both confirm completion → completed', async () => {
    const { employer, worker, id } = await confirmedAssignment();
    expect((await act(worker, 'worker', id, 'start')).status).toBe(409); // only employers start

    expect((await act(employer, 'employer', id, 'start')).body.assignment.status).toBe('in_progress');
    const half = await act(worker, 'worker', id, 'complete');
    expect(half.body.assignment).toMatchObject({ status: 'completion_pending', workerConfirmedAt: expect.any(String) });
    expect((await act(worker, 'worker', id, 'complete')).status).toBe(409); // cannot confirm twice

    const done = await act(employer, 'employer', id, 'complete');
    expect(done.body.assignment).toMatchObject({ status: 'completed', completedAt: expect.any(String), actions: [] });
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'assignment_completed'`).pluck().get()).toBe(1);
  });

  it('cannot complete work that has not started yet', async () => {
    const { worker, id } = await confirmedAssignment({ startDate: daysFromToday(5) });
    const res = await act(worker, 'worker', id, 'complete');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTION_NOT_ALLOWED');
  });

  it('cancelling frees the place, reopens a filled job and needs a reason', async () => {
    const { employer, worker, jobId, id } = await confirmedAssignment({ workersRequired: 1 });
    expect(jobRow(jobId)).toEqual({ status: 'filled', assigned: 1 });

    const noReason = await act(worker, 'worker', id, 'cancel');
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.details).toEqual([{ field: 'reason', code: 'required' }]);

    const res = await act(worker, 'worker', id, 'cancel', 'Fell ill');
    expect(res.body.assignment).toMatchObject({ status: 'cancelled', cancelledBy: 'worker', cancellationReason: 'Fell ill' });
    expect(jobRow(jobId)).toEqual({ status: 'open', assigned: 0 });
    expect(db.prepare(`SELECT user_id FROM notifications WHERE type = 'assignment_cancelled'`).pluck().get()).toBe(employer.userId);
    expect((await act(employer, 'employer', id, 'start')).status).toBe(409); // final
  });

  it('disputes are possible once work is under way, with a reason', async () => {
    const { employer, worker, id } = await confirmedAssignment();
    expect((await act(worker, 'worker', id, 'dispute', 'Not paid')).status).toBe(409); // not started yet
    await act(employer, 'employer', id, 'complete');
    const res = await act(worker, 'worker', id, 'dispute', 'Work hours were longer than agreed');
    expect(res.body.assignment).toMatchObject({ status: 'disputed', disputedBy: 'worker', actions: [] });
    // After someone confirmed completion, cancelling is no longer possible (dispute instead).
  });

  it('keeps assignments private to their worker and employer', async () => {
    const { id } = await confirmedAssignment();
    const otherWorker = await workerAgent('Someone Else');
    const otherEmployer = await employerAgent();
    expect((await otherWorker.get(`/api/worker/assignments/${id}`)).status).toBe(404);
    expect((await otherEmployer.get(`/api/employer/assignments/${id}`)).status).toBe(404);
    expect((await act(otherEmployer, 'employer', id, 'start')).status).toBe(404);
    expect((await otherWorker.get('/api/worker/assignments')).body.assignments).toEqual([]);
    expect((await request(app).get('/api/worker/assignments')).status).toBe(401);
  });

  it('the database refuses invalid assignment status jumps', async () => {
    const { id } = await confirmedAssignment();
    expect(() => db.prepare(`UPDATE assignments SET status = 'completed', completed_at = 'x' WHERE id = ?`).run(id)).toThrow(
      /invalid assignment status transition/,
    );
    expect(() => db.prepare(`UPDATE assignments SET status = 'disputed' WHERE id = ?`).run(id)).toThrow(
      /invalid assignment status transition/,
    );
  });

  it('lists by group', async () => {
    const { worker, employer, id } = await confirmedAssignment();
    expect((await worker.get('/api/worker/assignments?group=active')).body.assignments).toHaveLength(1);
    await act(employer, 'employer', id, 'cancel', 'Plans changed');
    expect((await worker.get('/api/worker/assignments?group=active')).body.assignments).toHaveLength(0);
    expect((await worker.get('/api/worker/assignments?group=cancelled')).body.assignments).toHaveLength(1);
  });
});

describe('job editing and cancelling with confirmed workers', () => {
  const editBody = (overrides = {}) => ({
    title: 'Hostel cleaning help', category: 'cleaning', description: 'Sweeping and mopping two hostel floors.',
    district: 'dakshina_kannada', locality: 'Kankanady', startDate: daysFromToday(0), startTime: '08:00',
    endTime: '16:00', durationType: 'one_day', wageAmount: 700, wageBasis: 'per_day', workersRequired: 2, ...overrides,
  });

  it('locks agreed terms once workers are confirmed, but allows adding places', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer, { workersRequired: 1 });
    const applicationId = await apply(await workerAgent(), jobId);
    await accept(employer, jobId, applicationId);
    expect(jobRow(jobId).status).toBe('filled');

    const wage = await employer.put(`/api/employer/jobs/${jobId}`).send(editBody({ wageAmount: 500, workersRequired: 1 }));
    expect(wage.status).toBe(409);
    expect(wage.body.error.code).toBe('JOB_HAS_WORKERS');

    const more = await employer.put(`/api/employer/jobs/${jobId}`).send(editBody({ workersRequired: 3 }));
    expect(more.status).toBe(200);
    expect(more.body.job).toMatchObject({ status: 'open', vacancies: 2, approvalStatus: 'approved' });
  });

  it('cancelling a job cancels confirmed assignments and frees everyone', async () => {
    const employer = await employerAgent();
    const worker = await workerAgent();
    const jobId = jobFor(employer);
    await accept(employer, jobId, await apply(worker, jobId));
    const pendingWorker = await workerAgent('Still Waiting');
    await apply(pendingWorker, jobId);

    const noReason = await employer.post(`/api/employer/jobs/${jobId}/cancel`).send({});
    expect(noReason.status).toBe(400);

    const res = await employer.post(`/api/employer/jobs/${jobId}/cancel`).send({ reason: 'Event postponed' });
    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({ status: 'cancelled', workersAssigned: 0, canCancel: false });
    const mine = await worker.get('/api/worker/assignments');
    expect(mine.body.assignments[0]).toMatchObject({ status: 'cancelled', cancelledBy: 'employer', cancellationReason: 'Event postponed' });
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'job_cancelled'`).pluck().get()).toBe(1);
  });

  it('cannot cancel a job once confirmed work has started', async () => {
    const employer = await employerAgent();
    const jobId = jobFor(employer);
    const applicationId = await apply(await workerAgent(), jobId);
    const { body } = await accept(employer, jobId, applicationId);
    await employer.post(`/api/employer/assignments/${body.assignmentId}/start`);
    const res = await employer.post(`/api/employer/jobs/${jobId}/cancel`).send({ reason: 'Changed my mind' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('JOB_NOT_CANCELLABLE');
  });
});
