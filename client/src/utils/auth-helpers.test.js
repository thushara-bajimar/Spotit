import { describe, expect, it } from 'vitest';
import { homePathForRole, postLoginPath } from './roles.js';
import { checks, normalizePhone, validate } from './validation.js';

describe('post-login redirects', () => {
  it('sends each role to its own home', () => {
    expect(homePathForRole('worker')).toBe('/worker');
    expect(homePathForRole('employer')).toBe('/employer');
    expect(homePathForRole('admin')).toBe('/admin');
  });

  it('follows ?next only inside the user’s own area', () => {
    expect(postLoginPath('worker', '/worker/jobs')).toBe('/worker/jobs');
    expect(postLoginPath('worker', '/admin')).toBe('/worker');
    expect(postLoginPath('worker', '/workerish')).toBe('/worker');
    expect(postLoginPath('worker', 'https://evil.example')).toBe('/worker');
    expect(postLoginPath('worker', '//evil.example/worker')).toBe('/worker');
    expect(postLoginPath('employer', null)).toBe('/employer');
  });
});

describe('client validation', () => {
  it('normalises common Indian phone formats', () => {
    for (const input of ['9876543210', '98765 43210', '+91 98765-43210', '919876543210', '09876543210']) {
      expect(normalizePhone(input)).toBe('9876543210');
    }
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
  });

  it('returns translatable error codes', () => {
    const errors = validate(
      { fullName: 'A', phone: '123', password: 'short' },
      { fullName: checks.text(2, 100), phone: checks.phone, password: checks.newPassword },
    );
    expect(errors).toEqual({ fullName: 'too_short', phone: 'invalid_phone', password: 'password_too_short' });
  });
});
