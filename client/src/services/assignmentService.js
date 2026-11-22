import { apiRequest } from './apiClient.js';

/*
 * Assignments exist for both roles with the same shape. `role` is 'worker' or
 * 'employer' and selects /api/worker/... or /api/employer/... — the server
 * still decides what each role may see and do.
 */

export async function fetchAssignments(role, { group, jobId } = {}, { signal } = {}) {
  const query = new URLSearchParams();
  if (group) query.set('group', group);
  if (jobId) query.set('jobId', jobId);
  return (await apiRequest(`/${role}/assignments?${query}`, { signal })).assignments;
}

export async function fetchAssignment(role, assignmentId, { signal } = {}) {
  return (await apiRequest(`/${role}/assignments/${encodeURIComponent(assignmentId)}`, { signal })).assignment;
}

/** action: start | complete | cancel | dispute (reason required for cancel/dispute). */
export async function assignmentActionRequest(role, assignmentId, action, reason) {
  const data = await apiRequest(`/${role}/assignments/${encodeURIComponent(assignmentId)}/${action}`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
  return data.assignment;
}
