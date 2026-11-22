import { apiRequest } from './apiClient.js';

/** Karnataka districts (id + English/Kannada names). */
export async function fetchDistricts({ signal } = {}) {
  const data = await apiRequest('/districts', { signal });
  return data.districts;
}
