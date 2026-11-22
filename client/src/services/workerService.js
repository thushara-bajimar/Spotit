import { apiRequest } from './apiClient.js';

/** Marketplace search. `params` keys match the URL query (q, category, district, …). */
export function fetchJobs(params, { signal } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return apiRequest(`/worker/jobs?${query}`, { signal });
}

export async function fetchJob(jobId, { signal } = {}) {
  const data = await apiRequest(`/worker/jobs/${encodeURIComponent(jobId)}`, { signal });
  return data.job;
}

export async function applyToJobRequest(jobId, message) {
  const data = await apiRequest(`/worker/jobs/${encodeURIComponent(jobId)}/applications`, {
    method: 'POST',
    body: message ? { message } : {},
  });
  return data.application;
}

export function fetchMyApplications(status, { signal } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/worker/applications${query}`, { signal });
}

export async function withdrawApplicationRequest(applicationId) {
  const data = await apiRequest(`/worker/applications/${encodeURIComponent(applicationId)}/withdraw`, {
    method: 'POST',
  });
  return data.application;
}

export async function fetchWorkerProfile({ signal } = {}) {
  const data = await apiRequest('/worker/profile', { signal });
  return data.profile;
}
