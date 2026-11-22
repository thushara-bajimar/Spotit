import { describe, expect, it } from 'vitest';
import { formatDate, formatRupees, formatTime } from './format.js';

describe('format helpers', () => {
  it('formats rupees with Indian grouping and no decimals', () => {
    expect(formatRupees(700)).toBe('₹700');
    expect(formatRupees(125000)).toBe('₹1,25,000');
  });

  it('formats calendar dates without timezone drift', () => {
    expect(formatDate('2026-12-12', 'en')).toMatch(/12 Dec/);
  });

  it('formats 24h times for display', () => {
    expect(formatTime('08:00', 'en')).toMatch(/^8:00\s?am$/i);
    expect(formatTime('16:30', 'en')).toMatch(/^4:30\s?pm$/i);
  });

  it('produces Kannada output for kn', () => {
    expect(formatDate('2026-12-12', 'kn')).toMatch(/[ಀ-೿]/);
  });
});
