import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAdminAccount } from '../src/modules/auth/auth.service.js';
import { createTestDb } from './helpers.js';

let db;
let app;

beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true, rateLimit: false });
});
afterEach(() => db.close());

const worker = {
  fullName: '  Ravi   Kumar ',
  phone: '+91 98765 43210',
  password: 'secret123',
  preferredLanguage: 'kn',
  district: 'dakshina_kannada',
  locality: 'Kankanady',
  skills: ['cleaning', 'gardening'],
};

const employer = {
  fullName: 'Asha Shetty',
  phone: '9123456780',
  password: 'secret123',
  preferredLanguage: 'en',
  employerType: 'hotel_restaurant',
  businessName: 'Sea View Hotel',
  district: 'udupi',
  locality: 'Malpe',
};

/** Registers and returns a supertest agent that keeps the session cookie. */
async function signedInAgent(path, body) {
  const agent = request.agent(app);
  const res = await agent.post(`/api/auth/register/${path}`).send(body);
  expect(res.status).toBe(201);
  return agent;
}

async function adminAgent() {
  await createAdminAccount(db, { fullName: 'Admin', phone: '9000000001', password: 'adminpass1' });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ phone: '9000000001', password: 'adminpass1' });
  expect(res.status).toBe(200);
  return agent;
}

describe('worker registration', () => {
  it('creates the user and profile, normalises input and logs in', async () => {
    const res = await request(app).post('/api/auth/register/worker').send(worker);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      fullName: 'Ravi Kumar',
      phone: '9876543210',
      role: 'worker',
      preferredLanguage: 'kn',
      district: 'dakshina_kannada',
      locality: 'Kankanady',
      employer: null,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^spotit_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const profile = db.prepare('SELECT skills FROM worker_profiles WHERE user_id = ?').get(res.body.user.id);
    expect(JSON.parse(profile.skills)).toEqual(['cleaning', 'gardening']);
  });

  it('stores a bcrypt hash, never the password', async () => {
    await request(app).post('/api/auth/register/worker').send(worker);
    const { password_hash: hash } = db.prepare('SELECT password_hash FROM users').get();
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain(worker.password);
  });

  it('rejects duplicate phone numbers with 409', async () => {
    await request(app).post('/api/auth/register/worker').send(worker);
    const res = await request(app)
      .post('/api/auth/register/employer')
      .send({ ...employer, phone: '09876543210' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register/worker')
      .send({ fullName: 'A', phone: '12345', password: 'short', district: 'atlantis', skills: ['flying'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'fullName', code: 'too_short' },
        { field: 'phone', code: 'invalid_phone' },
        { field: 'password', code: 'password_too_short' },
        { field: 'district', code: 'invalid_choice' },
        { field: 'locality', code: 'required' },
        { field: 'skills', code: 'invalid_choice' },
      ]),
    );
    expect(db.prepare('SELECT COUNT(*) FROM users').pluck().get()).toBe(0);
  });

  it('ignores attempts to choose a role or account status', async () => {
    const res = await request(app)
      .post('/api/auth/register/worker')
      .send({ ...worker, role: 'admin', accountStatus: 'active', verificationStatus: 'approved' });
    expect(res.body.user.role).toBe('worker');
  });
});

describe('employer registration', () => {
  it('creates an employer whose approval is pending', async () => {
    const res = await request(app).post('/api/auth/register/employer').send(employer);

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('employer');
    expect(res.body.user.employer).toEqual({
      employerType: 'hotel_restaurant',
      businessName: 'Sea View Hotel',
      verificationStatus: 'pending',
      rejectionReason: null,
    });
  });

  it('requires a business name except for individuals and households', async () => {
    const shop = await request(app)
      .post('/api/auth/register/employer')
      .send({ ...employer, employerType: 'shop', businessName: '' });
    expect(shop.status).toBe(400);
    expect(shop.body.error.details).toEqual([{ field: 'businessName', code: 'required' }]);

    const household = await request(app)
      .post('/api/auth/register/employer')
      .send({ ...employer, employerType: 'household', businessName: undefined });
    expect(household.status).toBe(201);
  });

  it('cannot self-approve', async () => {
    const res = await request(app)
      .post('/api/auth/register/employer')
      .send({ ...employer, verificationStatus: 'approved' });
    expect(res.body.user.employer.verificationStatus).toBe('pending');
  });
});

describe('login, current user and logout', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register/worker').send(worker);
  });

  it('logs in with correct credentials (any common phone format)', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ phone: '98765-43210', password: worker.password });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('9876543210');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.fullName).toBe('Ravi Kumar');
    expect(me.headers['cache-control']).toBe('no-store');
  });

  it('rejects a wrong password and an unknown phone with the same error', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ phone: worker.phone, password: 'wrong-password' });
    const unknownPhone = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9999999999', password: worker.password });

    for (const res of [wrongPassword, unknownPhone]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('returns user: null when not logged in', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('logout ends the session on the server', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).get('/api/worker/profile').set('Cookie', cookie)).status).toBe(200);

    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();

    // Replaying the old cookie no longer works either.
    const replay = await request(app).get('/api/worker/profile').set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) FROM sessions').pluck().get()).toBe(1); // only the registration session
  });

  it('rotates the session on login', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    await agent.post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    // registration session + exactly one live session for this agent
    expect(db.prepare('SELECT COUNT(*) FROM sessions').pluck().get()).toBe(2);
  });

  it('ignores forged or expired session cookies', async () => {
    const forged = await request(app).get('/api/auth/me').set('Cookie', 'spotit_session=not-a-real-token-value-123');
    expect(forged.body.user).toBeNull();

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    db.prepare(`UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'`).run();
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });
});

describe('suspended accounts', () => {
  it('cannot log in, and existing sessions stop working', async () => {
    const agent = await signedInAgent('worker', worker);
    db.prepare(
      `UPDATE users SET account_status = 'suspended', suspended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    ).run();

    expect((await agent.get('/api/worker/profile')).status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) FROM sessions').pluck().get()).toBe(0);

    const login = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('role-based authorization (enforced by the API)', () => {
  it('blocks anonymous users with 401', async () => {
    for (const path of ['/api/worker/profile', '/api/employer/profile', '/api/admin/stats']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('gives each role only its own area', async () => {
    const workerAgent = await signedInAgent('worker', worker);
    const employerAgent = await signedInAgent('employer', employer);
    const admin = await adminAgent();

    const matrix = [
      [workerAgent, '/api/worker/profile', 200],
      [workerAgent, '/api/employer/profile', 403],
      [workerAgent, '/api/admin/stats', 403],
      [employerAgent, '/api/employer/profile', 200],
      [employerAgent, '/api/worker/profile', 403],
      [employerAgent, '/api/admin/stats', 403],
      [admin, '/api/admin/stats', 200],
      [admin, '/api/worker/profile', 403],
      [admin, '/api/employer/profile', 403],
    ];
    for (const [agent, path, status] of matrix) {
      const res = await agent.get(path);
      expect(res.status, `${path}`).toBe(status);
    }
  });

  it('serves live admin stats', async () => {
    await signedInAgent('worker', worker);
    await signedInAgent('employer', employer);
    const res = await (await adminAgent()).get('/api/admin/stats');
    expect(res.body.stats).toMatchObject({ workers: 1, employers: 1, pendingEmployers: 1, pendingJobs: 0 });
  });

  it('has no public way to create an admin', async () => {
    const res = await request(app)
      .post('/api/auth/register/admin')
      .send({ ...worker, role: 'admin' });
    expect(res.status).toBe(404);
  });
});

describe('preferred language', () => {
  it('saves and returns the language preference', async () => {
    const agent = await signedInAgent('worker', { ...worker, preferredLanguage: 'en' });
    const res = await agent.patch('/api/auth/me/language').send({ preferredLanguage: 'kn' });
    expect(res.status).toBe(200);
    expect(res.body.user.preferredLanguage).toBe('kn');
    expect((await agent.get('/api/auth/me')).body.user.preferredLanguage).toBe('kn');

    expect((await agent.patch('/api/auth/me/language').send({ preferredLanguage: 'fr' })).status).toBe(400);
    expect((await request(app).patch('/api/auth/me/language').send({ preferredLanguage: 'kn' })).status).toBe(401);
  });
});

describe('CSRF origin check', () => {
  it('rejects state-changing requests from foreign origins', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ phone: worker.phone, password: worker.password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('accepts the dev client origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ phone: worker.phone, password: worker.password });
    expect(res.status).toBe(401); // reached the handler; user does not exist in this test
  });
});

describe('rate limiting', () => {
  it('blocks repeated failed logins from one IP', async () => {
    const limitedApp = createApp({ db, isProduction: true, rateLimit: true });
    let last;
    for (let i = 0; i < 11; i += 1) {
      last = await request(limitedApp).post('/api/auth/login').send({ phone: '9876543210', password: 'nope-nope' });
    }
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('reference data', () => {
  it('lists districts in both languages', async () => {
    const res = await request(app).get('/api/districts');
    expect(res.body.districts).toHaveLength(31);
    expect(res.body.districts).toContainEqual({
      id: 'dakshina_kannada',
      nameEn: 'Dakshina Kannada',
      nameKn: 'ದಕ್ಷಿಣ ಕನ್ನಡ',
    });
  });
});
