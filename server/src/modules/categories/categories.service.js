/** Active job categories in display order, with names in both languages. */
export function listActiveCategories(db) {
  return db
    .prepare(
      `SELECT id, slug, name_en AS nameEn, name_kn AS nameKn, icon
         FROM job_categories
        WHERE is_active = 1
        ORDER BY sort_order, id`,
    )
    .all();
}
