import { apiRequest } from './apiClient.js';

/** Current user, or null when not logged in. */
export async function fetchCurrentUser({ signal } = {}) {
  const data = await apiRequest('/auth/me', { signal });
  return data.user;
}

export async function loginRequest({ phone, password }) {
  const data = await apiRequest('/auth/login', { method: 'POST', body: { phone, password } });
  return data.user;
}

export async function registerWorkerRequest(details) {
  const data = await apiRequest('/auth/register/worker', { method: 'POST', body: details });
  return data.user;
}

export async function registerEmployerRequest(details) {
  const data = await apiRequest('/auth/register/employer', { method: 'POST', body: details });
  return data.user;
}

export async function logoutRequest() {
  await apiRequest('/auth/logout', { method: 'POST' });
}

export async function saveLanguageRequest(preferredLanguage) {
  const data = await apiRequest('/auth/me/language', { method: 'PATCH', body: { preferredLanguage } });
  return data.user;
}
