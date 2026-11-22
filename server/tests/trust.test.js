import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAdminAccount } from '../src/modules/auth/auth.service.js';
import { createTestDb, daysFromToday, insertJob } from './helpers.js';

let db;
let app;
beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true, rateLimit: false });
});
afterEach(() => db.close());

let seq = 0;
const nextPhone = () => `9${String(900000000 + (seq += 1)).slice(-9)}`;

async function employerAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/employer').send({
    fullName: 'Asha Shetty', phone: nextPhone(), password: 'employer1',
    employerType: 'hotel_restaurant', businessName: 'Sea View Hotel', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  db.prepare(`UPDATE employer_profiles SET verification_status = 'approved' WHERE user_id = ?`).run(agent.userId);
  return agent;
}
async function workerAgent(name = 'Ravi Kumar') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register/worker').send({
    fullName: name, phone: nextPhone(), password: 'worker123', district: 'udupi', locality: 'Malpe',
  });
  agent.userId = res.body.user.id;
  return agent;
}

/** Employer + worker with a confirmed assignment on a job that starts today. */
async function setup() {
  const employer = await employerAgent();
  const worker = await workerAgent();
  const jobId = insertJob(db, employer.userId, { startDate: daysFromToday(0), wageAmount: 600 });
  const { body } = await worker.post(`/api/worker/jobs/${jobId}/applications`).send({});
  const accepted = await employer.post(`/api/employer/jobs/${jobId}/applications/${body.application.id}/accept`);
  return { employer, worker, jobId, id: accepted.body.assignmentId };
}
const complete = async ({ employer, worker, id }) => {
  await worker.post(`/api/worker/assignments/${id}/complete`);
  return employer.post(`/api/employer/assignments/${id}/complete`);
};

describe('completion with one-sided confirmation', () => {
  it('waits for the other side, which can confirm or dispute', async () => {
    const ctx = await setup();
    const half = await ctx.worker.post(`/api/worker/assignments/${ctx.id}/complete`);
    expect(half.body.assignment.status).toBe('completion_pending');
    const view = await ctx.employer.get(`/api/employer/assignments/${ctx.id}`);
    expect(view.body.assignment.actions).toEqual(['complete', 'dispute']);
    // The side that already confirmed can escalate if the other never responds.
    const mine = await ctx.worker.get(`/api/worker/assignments/${ctx.id}`);
    expect(mine.body.assignment.actions).toEqual(['dispute']);
    expect((await ctx.employer.post(`/api/employer/assignments/${ctx.id}/complete`)).body.assignment.status).toBe('completed');
  });
});

describe('payment tracking', () => {
  const markPaid = (ctx, body) => ctx.employer.post(`/api/employer/assignments/${ctx.id}/payment/markPaid`).send(body);

  it('employer marks paid, worker confirms receipt; both see it and it becomes final', async () => {
    const ctx = await setup();
    // Not before work has started.
    expect((await markPaid(ctx, { amountPaid: 600, paidOn: daysFromToday(0) })).body.error.code).toBe('PAYMENT_ACTION_NOT_ALLOWED');
    await complete(ctx);

    expect((await markPaid(ctx, { amountPaid: 0, paidOn: 'yesterday' })).status).toBe(400);
    const future = await markPaid(ctx, { amountPaid: 600, paidOn: daysFromToday(2) });
    expect(future.body.error.details).toEqual([{ field: 'paidOn', code: 'date_in_future' }]);

    const paid = await markPaid(ctx, { amountPaid: 600, paidOn: daysFromToday(0), note: 'Paid in cash' });
    expect(paid.body.assignment.payment).toMatchObject({ status: 'paid', amountPaid: 600, notes: 'Paid in cash', agreedAmount: 600 });
    expect(db.prepare(`SELECT user_id FROM notifications WHERE type = 'payment_marked_paid'`).pluck().get()).toBe(ctx.worker.userId);

    const workerView = await ctx.worker.get(`/api/worker/assignments/${ctx.id}`);
    expect(workerView.body.assignment.payment.actions).toEqual(['confirm', 'dispute']);
    const confirmed = await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/confirm`);
    expect(confirmed.body.assignment.payment).toMatchObject({ workerConfirmedAt: expect.any(String), actions: [] });
    expect(db.prepare(`SELECT user_id FROM notifications WHERE type = 'payment_confirmed'`).pluck().get()).toBe(ctx.employer.userId);

    // Final: no more changes, also enforced by the database.
    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/dispute`).send({ reason: 'changed my mind' })).status).toBe(409);
    expect(() => db.prepare(`UPDATE payments SET status = 'disputed'`).run()).toThrow(/invalid payment status/);
  });

  it('worker reports unpaid wages: payment disputed, admin report opened, employer can then record payment', async () => {
    const ctx = await setup();
    await complete(ctx);
    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/dispute`).send({})).status).toBe(400);
    const disputed = await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/dispute`).send({ reason: 'Not paid after 3 days' });
    expect(disputed.body.assignment.payment).toMatchObject({ status: 'disputed', disputeReason: 'Not paid after 3 days' });

    const report = db.prepare('SELECT category, reporter_id, reported_user_id, assignment_id FROM reports').get();
    expect(report).toEqual({ category: 'unpaid_wage', reporter_id: ctx.worker.userId, reported_user_id: ctx.employer.userId, assignment_id: ctx.id });
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'payment_disputed'`).pluck().get()).toBe(1);

    const paid = await markPaid(ctx, { amountPaid: 600, paidOn: daysFromToday(0) });
    expect(paid.body.assignment.payment.status).toBe('paid');
    // Worker can't confirm a pending payment; only after it's marked paid (DB enforces too).
    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/confirm`)).status).toBe(200);
  });

  it('only the right side can do each payment action', async () => {
    const ctx = await setup();
    await complete(ctx);
    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/payment/markPaid`).send({ amountPaid: 1, paidOn: daysFromToday(0) })).status).toBe(409);
    expect((await ctx.employer.post(`/api/employer/assignments/${ctx.id}/payment/confirm`)).status).toBe(409);
    const stranger = await employerAgent();
    expect((await stranger.post(`/api/employer/assignments/${ctx.id}/payment/markPaid`).send({ amountPaid: 1, paidOn: daysFromToday(0) })).status).toBe(404);
    expect(() => db.prepare(`UPDATE payments SET worker_confirmed_at = 'x'`).run()).toThrow(/only a paid payment/);
  });
});

describe('two-way ratings', () => {
  it('both sides rate once after completion; ratings show up on profiles and job cards', async () => {
    const ctx = await setup();
    const early = await ctx.worker.post(`/api/worker/assignments/${ctx.id}/review`).send({ rating: 5 });
    expect(early.body.error.code).toBe('REVIEW_NOT_ALLOWED');
    await complete(ctx);

    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/review`).send({ rating: 6 })).status).toBe(400);
    const mine = await ctx.worker.post(`/api/worker/assignments/${ctx.id}/review`).send({ rating: 4, comment: 'Fair employer' });
    expect(mine.status).toBe(201);
    expect(mine.body.assignment).toMatchObject({ myReview: { rating: 4, comment: 'Fair employer' }, canReview: false, theirReview: null });
    expect((await ctx.worker.post(`/api/worker/assignments/${ctx.id}/review`).send({ rating: 1 })).body.error.code).toBe('ALREADY_REVIEWED');

    await ctx.employer.post(`/api/employer/assignments/${ctx.id}/review`).send({ rating: 5 });
    const workerView = await ctx.worker.get(`/api/worker/assignments/${ctx.id}`);
    expect(workerView.body.assignment.theirReview).toMatchObject({ rating: 5 });
    expect(db.prepare(`SELECT COUNT(*) FROM notifications WHERE type = 'review_received'`).pluck().get()).toBe(2);

    const received = await ctx.employer.get('/api/reviews/received');
    expect(received.body).toMatchObject({ rating: { average: 4, count: 1 }, reviews: [{ rating: 4, reviewerName: 'Ravi Kumar' }] });

    insertJob(db, ctx.employer.userId, { title: 'Another job here' });
    const market = await (await workerAgent('Other')).get('/api/worker/jobs?q=Another');
    expect(market.body.jobs[0].employer.rating).toEqual({ average: 4, count: 1 });
  });

  it('hidden reviews are not shown to the reviewee or counted', async () => {
    const ctx = await setup();
    await complete(ctx);
    await ctx.employer.post(`/api/employer/assignments/${ctx.id}/review`).send({ rating: 1, comment: 'abusive words' });
    db.prepare(`UPDATE reviews SET moderation_status = 'hidden'`).run();
    expect((await ctx.worker.get(`/api/worker/assignments/${ctx.id}`)).body.assignment.theirReview).toBeNull();
    expect((await ctx.worker.get('/api/reviews/received')).body).toEqual({ rating: { average: null, count: 0 }, reviews: [] });
  });
});

describe('user reports', () => {
  it('reports a job, an assignment counterpart and a review; the reported person is derived by the server', async () => {
    const ctx = await setup();
    const jobReport = await ctx.worker.post('/api/reports').send({
      category: 'misleading_job', description: 'Hours were different from the listing.', targetType: 'job', targetId: ctx.jobId, reportedUserId: 999,
    });
    expect(jobReport.status).toBe(201);
    expect(db.prepare('SELECT reported_user_id FROM reports WHERE id = ?').pluck().get(jobReport.body.report.id)).toBe(ctx.employer.userId);
    expect((await ctx.worker.post('/api/reports').send({
      category: 'misleading_job', description: 'Reporting the same job twice.', targetType: 'job', targetId: ctx.jobId,
    })).body.error.code).toBe('ALREADY_REPORTED');

    const workerReport = await ctx.employer.post('/api/reports').send({
      category: 'misconduct', description: 'Came late and left early.', targetType: 'assignment', targetId: ctx.id,
    });
    expect(db.prepare('SELECT reported_user_id FROM reports WHERE id = ?').pluck().get(workerReport.body.report.id)).toBe(ctx.worker.userId);

    await complete(ctx);
    await ctx.employer.post(`/api/employer/assignments/${ctx.id}/review`).send({ rating: 1, comment: 'Lazy fellow' });
    const reviewId = db.prepare('SELECT id FROM reviews').pluck().get();
    expect((await ctx.employer.post('/api/reports').send({ category: 'harassment', description: 'My own review, not allowed.', targetType: 'review', targetId: reviewId })).status).toBe(404);
    expect((await ctx.worker.post('/api/reports').send({ category: 'harassment', description: 'This review insults me.', targetType: 'review', targetId: reviewId })).status).toBe(201);
    expect((await ctx.worker.get('/api/reviews/received')).body.reviews[0].reported).toBe(true);

    const mine = await ctx.worker.get('/api/reports/mine');
    expect(mine.body.reports.map((r) => r.category).sort()).toEqual(['harassment', 'misleading_job']);
  });

  it('cannot report unrelated assignments or unapproved jobs, and admins cannot file reports', async () => {
    const ctx = await setup();
    const stranger = await workerAgent('Stranger');
    expect((await stranger.post('/api/reports').send({ category: 'misconduct', description: 'Not my assignment at all.', targetType: 'assignment', targetId: ctx.id })).status).toBe(404);
    const hidden = insertJob(db, ctx.employer.userId, { approvalStatus: 'pending' });
    expect((await stranger.post('/api/reports').send({ category: 'spam', description: 'Unapproved job report.', targetType: 'job', targetId: hidden })).status).toBe(404);
    expect((await stranger.post('/api/reports').send({ category: 'spam', description: 'General complaint here.', targetType: 'none' })).status).toBe(400);
    expect((await stranger.post('/api/reports').send({ category: 'other', description: 'General complaint here.', targetType: 'none' })).status).toBe(201);

    const phone = nextPhone();
    await createAdminAccount(db, { fullName: 'Admin', phone, password: 'adminpass1' });
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ phone, password: 'adminpass1' });
    expect((await admin.post('/api/reports').send({ category: 'other', description: 'Admins do not file.', targetType: 'none' })).status).toBe(403);
  });
});

describe('notifications', () => {
  it('lists my notifications, counts unread, marks one and all as read; never others', async () => {
    const ctx = await setup(); // employer got application_received, worker got application_accepted
    const list = await ctx.worker.get('/api/notifications');
    expect(list.body).toMatchObject({ unreadCount: 1, total: 1 });
    expect(list.body.notifications[0]).toMatchObject({ type: 'application_accepted', isRead: false, jobId: ctx.jobId, assignmentId: ctx.id, params: { jobTitle: 'Hostel cleaning help' } });

    const employerNote = (await ctx.employer.get('/api/notifications')).body.notifications[0];
    expect((await ctx.worker.post(`/api/notifications/${employerNote.id}/read`)).status).toBe(404);

    expect((await ctx.worker.post(`/api/notifications/${list.body.notifications[0].id}/read`)).body.unreadCount).toBe(0);
    await complete(ctx); // creates more notifications for both
    expect((await ctx.worker.get('/api/notifications/unread-count')).body.unreadCount).toBeGreaterThan(0);
    expect((await ctx.worker.post('/api/notifications/read-all')).body.unreadCount).toBe(0);
    expect((await ctx.worker.get('/api/notifications?unread=1')).body.notifications).toEqual([]);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});
