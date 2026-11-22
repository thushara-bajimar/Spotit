import { apiRequest } from './apiClient.js';

const id = (value) => encodeURIComponent(value);

export async function fetchEmployerProfile({ signal } = {}) {
  return (await apiRequest('/employer/profile', { signal })).profile;
}

/** Returns { profile, reviewRequired }. */
export function updateEmployerProfileRequest(details) {
  return apiRequest('/employer/profile', { method: 'PUT', body: details });
}

export function fetchEmployerDashboard({ signal } = {}) {
  return apiRequest('/employer/dashboard', { signal });
}

export async function fetchEmployerJobs(group, { signal } = {}) {
  const query = group ? `?group=${id(group)}` : '';
  return (await apiRequest(`/employer/jobs${query}`, { signal })).jobs;
}

export async function fetchEmployerJob(jobId, { signal } = {}) {
  return (await apiRequest(`/employer/jobs/${id(jobId)}`, { signal })).job;
}

export async function createJobRequest(details) {
  return (await apiRequest('/employer/jobs', { method: 'POST', body: details })).job;
}

/** Returns { job, reviewRequired, changedFields }. */
export function updateJobRequest(jobId, details) {
  return apiRequest(`/employer/jobs/${id(jobId)}`, { method: 'PUT', body: details });
}

export async function closeJobRequest(jobId, reason) {
  return (await apiRequest(`/employer/jobs/${id(jobId)}/close`, { method: 'POST', body: reason ? { reason } : {} }))
    .job;
}

export async function cancelJobRequest(jobId, reason) {
  return (await apiRequest(`/employer/jobs/${id(jobId)}/cancel`, { method: 'POST', body: { reason } })).job;
}

/** Returns { assignmentId, job }. */
export function acceptApplicationRequest(jobId, applicationId) {
  return apiRequest(`/employer/jobs/${id(jobId)}/applications/${id(applicationId)}/accept`, { method: 'POST' });
}

export function rejectApplicationRequest(jobId, applicationId) {
  return apiRequest(`/employer/jobs/${id(jobId)}/applications/${id(applicationId)}/reject`, { method: 'POST' });
}

export async function fetchApplicants({ jobId, status } = {}, { signal } = {}) {
  const query = new URLSearchParams();
  if (jobId) query.set('jobId', jobId);
  if (status) query.set('status', status);
  return (await apiRequest(`/employer/applicants?${query}`, { signal })).applicants;
}
