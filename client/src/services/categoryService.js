import { apiRequest } from './apiClient.js';

/** Job categories from the database (names in English and Kannada). */
export async function fetchCategories({ signal } = {}) {
  const data = await apiRequest('/categories', { signal });
  return data.categories;
}
