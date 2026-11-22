// ============================================================================
// DEVELOPMENT SAMPLE DATA — `npm run db:seed`
// Creates sample employers, jobs and one demo worker so the marketplace can be
// tried before employers can post jobs (Phase 4). Everything created here is
// labelled "[Sample]" and uses phone numbers 70000000xx.
// Safety: refuses to run with NODE_ENV=production; skips if already seeded.
// ============================================================================
import { config } from '../src/config/env.js';
import { openDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { todayInIndia } from '../src/utils/dates.js';

if (config.isProduction) {
  console.error('✗ db:seed creates sample data and will not run with NODE_ENV=production.');
  process.exit(1);
}

const SAMPLE_PASSWORD = 'sample1234';

const day = (offset) => {
  const [y, m, d] = todayInIndia().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};

const EMPLOYERS = [
  { key: 'hotel', name: 'Prakash Rao', phone: '7000000001', type: 'hotel_restaurant', business: '[Sample] Coastal Kitchen Hotel', district: 'dakshina_kannada', locality: 'Hampankatta' },
  { key: 'home', name: 'Lakshmi Bhat', phone: '7000000002', type: 'household', business: null, district: 'udupi', locality: 'Manipal' },
  { key: 'hospital', name: 'Joseph D’Souza', phone: '7000000003', type: 'hospital_institution', business: '[Sample] Riverside Nursing Home', district: 'dakshina_kannada', locality: 'Kankanady' },
  { key: 'shop', name: 'Imran Sheikh', phone: '7000000004', type: 'shop', business: '[Sample] Sheikh Textiles', district: 'mysuru', locality: 'Devaraja Mohalla' },
];

// [employer, category, title, description, district, locality, start, end, times, duration, wage, basis, workers, requirements, extra]
const JOBS = [
  ['hotel', 'hotel_restaurant', 'Kitchen helper for wedding lunch', 'Help the cooks with cutting vegetables, serving and washing vessels for a 300-guest wedding lunch.', 'dakshina_kannada', 'Kadri', 3, null, ['07:00', '16:00'], 'one_day', 700, 'per_day', 4, 'Clean clothes. Experience in a hotel kitchen is helpful.'],
  ['hotel', 'cleaning', 'Hotel room cleaning (weekend)', 'Clean and prepare 20 guest rooms on Saturday and Sunday. Cleaning materials provided.', 'dakshina_kannada', 'Hampankatta', 5, 6, ['09:00', '17:00'], 'multiple_days', 650, 'per_day', 2, null],
  ['hotel', 'hotel_restaurant', 'Evening table service staff', 'Serve food and clear tables during dinner hours for two weeks while our regular staff are on leave.', 'dakshina_kannada', 'Hampankatta', 2, 15, ['18:00', '23:00'], 'short_term', 120, 'per_hour', 3, 'Basic Kannada or English to talk to guests.'],
  ['home', 'household', 'Help with house shifting', 'Pack and carry household items to a new flat two streets away. Lifting required.', 'udupi', 'Manipal', 4, null, ['08:00', '13:00'], 'few_hours', 800, 'per_task', 2, 'Able to lift heavy boxes.'],
  ['home', 'gardening', 'Garden clearing and planting', 'Clear weeds, trim hedges and plant 30 saplings in a home garden.', 'udupi', 'Manipal', 7, null, ['07:30', '12:30'], 'few_hours', 600, 'per_task', 1, 'Bring your own sickle if possible.'],
  ['home', 'housekeeping', 'Deep cleaning before family function', 'Full cleaning of a 3-bedroom house including kitchen, windows and fans before a family function.', 'udupi', 'Kunjibettu', 9, null, ['09:00', '18:00'], 'one_day', 900, 'per_day', 2, null],
  ['hospital', 'hospital_institution', 'Ward assistant (night shift)', 'Assist nursing staff with patient movement, bed changes and keeping wards clean during night shifts.', 'dakshina_kannada', 'Kankanady', 1, 20, ['20:00', '06:00'], 'short_term', 4500, 'per_week', 2, 'Previous hospital or care work preferred.'],
  ['hospital', 'watchman', 'Security guard for main gate', 'Manage visitor entry and parking at the main gate. Uniform provided.', 'dakshina_kannada', 'Kankanady', 2, 30, ['08:00', '20:00'], 'short_term', 650, 'per_day', 1, 'Must be 21 or older.'],
  ['hospital', 'cleaning', 'Hospital corridor cleaning', 'Morning cleaning of corridors and waiting areas using provided equipment.', 'dakshina_kannada', 'Kankanady', 1, null, ['06:00', '10:00'], 'few_hours', 100, 'per_hour', 3, null],
  ['shop', 'shop_assistant', 'Sales helper for wedding season', 'Show sarees to customers, fold and arrange stock and help at billing during the busy season.', 'mysuru', 'Devaraja Mohalla', 3, 25, ['10:00', '20:00'], 'short_term', 600, 'per_day', 2, 'Kannada speaking. Polite with customers.'],
  ['shop', 'event_helper', 'Stall setup for exhibition', 'Set up and dismantle a textile stall at the Dasara exhibition grounds.', 'mysuru', 'Nazarbad', 6, 7, ['08:00', '18:00'], 'multiple_days', 750, 'per_day', 3, null],
  // Not visible in the marketplace — useful for checking filters.
  ['shop', 'other', 'Inventory counting (awaiting approval)', 'Count and record stock in the godown.', 'mysuru', 'Devaraja Mohalla', 10, null, ['10:00', '17:00'], 'one_day', 600, 'per_day', 2, null, { approval_status: 'pending' }],
  ['hotel', 'cleaning', 'Kitchen deep clean (already filled)', 'Deep clean of the hotel kitchen and storeroom.', 'dakshina_kannada', 'Hampankatta', 4, null, ['14:00', '20:00'], 'few_hours', 900, 'per_task', 1, null, { status: 'filled', workers_assigned: 1 }],
];

const db = openDatabase(config.databasePath);
try {
  runMigrations(db);

  if (db.prepare(`SELECT 1 FROM users WHERE phone = '7000000001'`).get()) {
    console.log('Sample data already present — nothing to do.');
    process.exit(0);
  }

  const passwordHash = await hashPassword(SAMPLE_PASSWORD);
  const categoryId = Object.fromEntries(
    db.prepare('SELECT slug, id FROM job_categories').all().map((c) => [c.slug, c.id]),
  );

  db.transaction(() => {
    const employerIds = {};
    for (const e of EMPLOYERS) {
      const id = Number(
        db.prepare(`INSERT INTO users (full_name, phone, password_hash, role) VALUES (?, ?, ?, 'employer')`)
          .run(e.name, e.phone, passwordHash).lastInsertRowid,
      );
      db.prepare(
        `INSERT INTO employer_profiles (user_id, employer_type, business_name, district, locality, verification_status, description)
         VALUES (?, ?, ?, ?, ?, 'approved', 'Sample data for development.')`,
      ).run(id, e.type, e.business, e.district, e.locality);
      employerIds[e.key] = id;
    }

    const insertJob = db.prepare(
      `INSERT INTO jobs (employer_id, category_id, title, description, district, locality, address,
                         start_date, end_date, start_time, end_time, duration_type, wage_amount, wage_basis,
                         workers_required, workers_assigned, requirements, approval_status, status, reviewed_at)
       VALUES (@employer, @category, @title, @description, @district, @locality, @address,
               @start, @end, @startTime, @endTime, @duration, @wage, @basis,
               @workers, @assigned, @requirements, @approval, @status, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    );
    for (const [emp, cat, title, description, district, locality, start, end, [startTime, endTime], duration, wage, basis, workers, requirements, extra = {}] of JOBS) {
      insertJob.run({
        employer: employerIds[emp],
        category: categoryId[cat],
        title: `[Sample] ${title}`,
        description,
        district,
        locality,
        address: `${locality} (sample address)`,
        start: day(start),
        end: end === null ? null : day(end),
        startTime,
        endTime,
        duration,
        wage,
        basis,
        workers,
        assigned: extra.workers_assigned ?? 0,
        requirements,
        approval: extra.approval_status ?? 'approved',
        status: extra.status ?? 'open',
      });
    }

    const workerId = Number(
      db.prepare(`INSERT INTO users (full_name, phone, password_hash, role) VALUES ('Demo Worker', '7000000010', ?, 'worker')`)
        .run(passwordHash).lastInsertRowid,
    );
    db.prepare(
      `INSERT INTO worker_profiles (user_id, district, locality, skills) VALUES (?, 'dakshina_kannada', 'Kankanady', '["cleaning","hotel_restaurant"]')`,
    ).run(workerId);
  })();

  console.log(`✓ Sample data created: ${EMPLOYERS.length} approved employers, ${JOBS.length} jobs, 1 demo worker.`);
  console.log(`  Demo worker login: 7000000010 / ${SAMPLE_PASSWORD}`);
  console.log(`  Sample employers:  7000000001–7000000004 / ${SAMPLE_PASSWORD}`);
} finally {
  if (db.open) db.close();
}
