import { clockTime, integer, isoDate, oneOf, text } from '../../utils/validation.js';
import { DISTRICT_IDS } from '../../constants/districts.js';
import { listActiveCategories } from '../categories/categories.service.js';

export const WAGE_BASES = ['per_hour', 'per_day', 'per_week', 'per_task'];
export const DURATION_TYPES = ['few_hours', 'one_day', 'multiple_days', 'short_term'];
const SINGLE_DAY = ['few_hours', 'one_day'];

// How far ahead jobs may be posted, and the longest short-term engagement.
const MAX_DAYS_AHEAD = 180;
const MAX_SPAN_DAYS = 180;

const dayDiff = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Field rules for creating or editing a job (employer side). */
export function jobSchema(db) {
  return {
    title: text({ min: 3, max: 120 }),
    category: (raw) => oneOf(listActiveCategories(db).map((c) => c.slug))(raw),
    description: text({ min: 10, max: 3000 }),
    district: oneOf(DISTRICT_IDS),
    locality: text({ min: 2, max: 100 }),
    address: text({ min: 3, max: 300, required: false }),
    startDate: isoDate({ required: true }),
    endDate: isoDate(),
    startTime: clockTime(),
    endTime: clockTime(),
    durationType: oneOf(DURATION_TYPES),
    wageAmount: integer({ min: 1, max: 1000000, required: true }),
    wageBasis: oneOf(WAGE_BASES),
    workersRequired: integer({ min: 1, max: 100, required: true }),
    requirements: text({ min: 3, max: 1000, required: false }),
  };
}

/**
 * Cross-field rules. Mutates `values` to normalise single-day jobs
 * (end date removed). Returns { field: code } for problems.
 * `today` is India's date; `existingStartDate` allows editing a job that
 * has already started without being forced to move its start date.
 */
export function refineJob(values, { today, existingStartDate = null }) {
  const errors = {};

  const startChanged = values.startDate !== existingStartDate;
  if (startChanged && values.startDate < today) errors.startDate = 'date_in_past';
  else if (dayDiff(today, values.startDate) > MAX_DAYS_AHEAD) errors.startDate = 'too_far_ahead';

  if (SINGLE_DAY.includes(values.durationType)) {
    values.endDate = null;
  } else if (!values.endDate) {
    errors.endDate = 'end_date_required';
  } else if (values.endDate <= values.startDate) {
    errors.endDate = 'end_before_start';
  } else if (dayDiff(values.startDate, values.endDate) > MAX_SPAN_DAYS) {
    errors.endDate = 'too_long_period';
  }

  if (values.startTime && values.startTime === values.endTime) errors.endTime = 'same_time';

  return errors;
}
