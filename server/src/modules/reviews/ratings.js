/*
 * Average rating of a user from VISIBLE reviews only (hidden reviews never
 * count). Used inside SELECTs: RATING_SQL('j.employer_id', 'employer_rating')
 * adds employer_rating_avg and employer_rating_count columns.
 */
export const RATING_SQL = (userColumn, alias) => `
  (SELECT ROUND(AVG(rr.rating), 1) FROM reviews rr
     WHERE rr.reviewee_id = ${userColumn} AND rr.moderation_status = 'visible') AS ${alias}_avg,
  (SELECT COUNT(*) FROM reviews rr
     WHERE rr.reviewee_id = ${userColumn} AND rr.moderation_status = 'visible') AS ${alias}_count`;

/** Row columns from RATING_SQL → { average, count }. */
export function ratingOf(row, alias) {
  const count = row[`${alias}_count`] ?? 0;
  return { average: count > 0 ? row[`${alias}_avg`] : null, count };
}
