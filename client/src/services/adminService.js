import { apiRequest } from './apiClient.js';

const qs = (params) => {
  const query = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v !== '' && v != null));
  const s = query.toString();
  return s ? `?${s}` : '';
};
const id = (value) => encodeURIComponent(value);
const post = (path, body) => apiRequest(path, { method: 'POST', body: body ?? {} });

export const fetchAdminStats = async ({ signal } = {}) => (await apiRequest('/admin/stats', { signal })).stats;

export const fetchEmployersForReview = async (params, { signal } = {}) =>
  (await apiRequest(`/admin/employers${qs(params)}`, { signal })).employers;
export const fetchEmployerForReview = async (employerId, { signal } = {}) =>
  (await apiRequest(`/admin/employers/${id(employerId)}`, { signal })).employer;
export const decideEmployerRequest = (employerId, decision, reason) =>
  post(`/admin/employers/${id(employerId)}/${decision}`, reason ? { reason } : {});

export const fetchJobsForReview = async (params, { signal } = {}) =>
  (await apiRequest(`/admin/jobs${qs(params)}`, { signal })).jobs;
export const fetchJobForReview = async (jobId, { signal } = {}) =>
  (await apiRequest(`/admin/jobs/${id(jobId)}`, { signal })).job;
export const decideJobRequest = (jobId, decision, reason) =>
  post(`/admin/jobs/${id(jobId)}/${decision}`, reason ? { reason } : {});

export const fetchUsers = (params, { signal } = {}) => apiRequest(`/admin/users${qs(params)}`, { signal });
export const fetchUser = async (userId, { signal } = {}) => (await apiRequest(`/admin/users/${id(userId)}`, { signal })).user;
export const setUserStatusRequest = (userId, action, reason) =>
  post(`/admin/users/${id(userId)}/${action}`, reason ? { reason } : {});

export const fetchReports = async (params, { signal } = {}) =>
  (await apiRequest(`/admin/reports${qs(params)}`, { signal })).reports;
export const fetchReport = async (reportId, { signal } = {}) =>
  (await apiRequest(`/admin/reports/${id(reportId)}`, { signal })).report;
export const reportActionRequest = (reportId, action, note) =>
  post(`/admin/reports/${id(reportId)}/${action}`, note ? { note } : {});

export const fetchReviews = async (params, { signal } = {}) =>
  (await apiRequest(`/admin/reviews${qs(params)}`, { signal })).reviews;
export const moderateReviewRequest = (reviewId, action, reason) => post(`/admin/reviews/${id(reviewId)}/${action}`, { reason });

export const fetchDisputes = async ({ signal } = {}) => (await apiRequest('/admin/disputes', { signal })).disputes;
export const resolveDisputeRequest = (assignmentId, outcome, note) =>
  post(`/admin/disputes/${id(assignmentId)}/resolve`, { outcome, note });

export const fetchAuditLog = (params, { signal } = {}) => apiRequest(`/admin/audit-log${qs(params)}`, { signal });
