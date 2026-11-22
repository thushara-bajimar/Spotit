import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestDb } from './helpers.js';

let db;
let app;

beforeEach(() => {
  db = createTestDb();
  app = createApp({ db, isProduction: true });
});

afterEach(() => db.close());

describe('GET /api/health', () => {
  it('reports the API and database as healthy', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('returns 503 when the database is unavailable', async () => {
    db.close();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'unavailable' });
    db = createTestDb(); // so afterEach can close something
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('GET /api/categories', () => {
  it('returns the seeded categories with English and Kannada names', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(10);
    for (const category of res.body.categories) {
      expect(category).toEqual({
        id: expect.any(Number),
        slug: expect.any(String),
        nameEn: expect.any(String),
        nameKn: expect.any(String),
        icon: expect.any(String),
      });
    }
    expect(res.body.categories[0].slug).toBe('cleaning');
  });

  it('hides inactive categories', async () => {
    db.prepare(`UPDATE job_categories SET is_active = 0 WHERE slug = 'other'`).run();
    const res = await request(app).get('/api/categories');

    expect(res.body.categories.map((c) => c.slug)).not.toContain('other');
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
