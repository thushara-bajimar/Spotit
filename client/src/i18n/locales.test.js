import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import kn from './locales/kn.json';

/** Flattens nested translation objects into { 'a.b.c': 'text' }. */
function flatten(object, prefix = '') {
  return Object.entries(object).reduce((result, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') Object.assign(result, flatten(value, path));
    else result[path] = value;
    return result;
  }, {});
}

const variables = (text) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const flatEn = flatten(en);
const flatKn = flatten(kn);

describe('language files', () => {
  it('English and Kannada have exactly the same keys', () => {
    const enKeys = Object.keys(flatEn).sort();
    const knKeys = Object.keys(flatKn).sort();
    expect(knKeys.filter((k) => !flatEn[k]), 'keys only in kn.json').toEqual([]);
    expect(enKeys.filter((k) => !flatKn[k]), 'keys missing from kn.json').toEqual([]);
  });

  it('has no empty translations', () => {
    for (const [file, flat] of [['en', flatEn], ['kn', flatKn]]) {
      const empty = Object.entries(flat).filter(([, v]) => typeof v !== 'string' || v.trim() === '');
      expect(empty.map(([k]) => k), `empty values in ${file}.json`).toEqual([]);
    }
  });

  it('uses the same {{variables}} in both languages', () => {
    const mismatched = Object.keys(flatEn).filter(
      (key) => JSON.stringify(variables(flatEn[key])) !== JSON.stringify(variables(flatKn[key] ?? '')),
    );
    expect(mismatched).toEqual([]);
  });

  it('actually translates Kannada text (contains Kannada script)', () => {
    // Values that are identical by design (e.g. language names) are allowed.
    const identicalByDesign = new Set(['language.en', 'language.kn']);
    const untranslated = Object.keys(flatKn).filter(
      (key) => !identicalByDesign.has(key) && !/[ಀ-೿]/.test(flatKn[key]),
    );
    expect(untranslated).toEqual([]);
  });
});
