const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Error thrown for any failed API call. `code` matches the server's error
 * codes (e.g. 'NOT_FOUND') or 'NETWORK_ERROR' when the server is unreachable,
 * so the UI can show a translated message via t(`errors.${code}`).
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Single entry point for talking to the SpotIt API. */
export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include', // send the session cookie (Phase 2)
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // A non-JSON 5xx usually means the dev proxy could not reach the API.
    const code = data?.error?.code ?? (response.status >= 500 ? 'NETWORK_ERROR' : 'HTTP_ERROR');
    throw new ApiError(response.status, code, data?.error?.message ?? response.statusText, data?.error?.details);
  }

  return data;
}
