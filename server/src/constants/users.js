// Allowed values that mirror CHECK constraints in the database schema.
export const ROLES = Object.freeze({ WORKER: 'worker', EMPLOYER: 'employer', ADMIN: 'admin' });
export const LANGUAGES = ['en', 'kn'];
export const EMPLOYER_TYPES = [
  'individual',
  'household',
  'small_business',
  'hotel_restaurant',
  'shop',
  'hospital_institution',
  'other',
];
// Individuals and households do not need a business / organisation name.
export const EMPLOYER_TYPES_WITHOUT_BUSINESS = ['individual', 'household'];

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password.
export const PASSWORD_MAX_BYTES = 72;
export const MAX_WORKER_SKILLS = 10;
