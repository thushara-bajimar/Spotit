import { anyPassword, listOf, newPassword, oneOf, phone, text } from '../../utils/validation.js';
import { DISTRICT_IDS } from '../../constants/districts.js';
import {
  EMPLOYER_TYPES,
  EMPLOYER_TYPES_WITHOUT_BUSINESS,
  LANGUAGES,
  MAX_WORKER_SKILLS,
} from '../../constants/users.js';
import { listActiveCategories } from '../categories/categories.service.js';

// Only what is needed to start using the app — no ID documents, email,
// date of birth or exact address are collected.
const accountFields = {
  fullName: text({ min: 2, max: 100 }),
  phone: phone(),
  password: newPassword(),
  preferredLanguage: oneOf(LANGUAGES, { required: false }),
};

export function workerRegistrationSchema(db) {
  return {
    ...accountFields,
    district: oneOf(DISTRICT_IDS),
    locality: text({ min: 2, max: 100 }),
    // Skills are chosen from job categories (simple tap-to-select in the UI).
    skills: listOf(() => listActiveCategories(db).map((c) => c.slug), { max: MAX_WORKER_SKILLS }),
  };
}

export const employerRegistrationSchema = {
  ...accountFields,
  employerType: oneOf(EMPLOYER_TYPES),
  businessName: text({ min: 2, max: 150, required: false }),
  district: oneOf(DISTRICT_IDS),
  locality: text({ min: 2, max: 100 }),
  address: text({ min: 3, max: 300, required: false }),
};

/** Businesses and institutions must give their name; individuals/households need not. */
export function refineEmployerRegistration(values) {
  if (!EMPLOYER_TYPES_WITHOUT_BUSINESS.includes(values.employerType) && !values.businessName) {
    return { businessName: 'required' };
  }
  return null;
}

export const loginSchema = {
  phone: phone(),
  password: anyPassword(),
};

export const languageSchema = {
  preferredLanguage: oneOf(LANGUAGES),
};
