import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data from an API function and tracks loading / error / success.
 * `fetcher` receives `{ signal }` so requests are cancelled on unmount.
 * Pass a stable function (defined at module level or wrapped in useCallback).
 */
export function useApiData(fetcher) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: 'loading', error: null }));

    fetcher({ signal: controller.signal })
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ status: 'error', data: null, error });
      });

    return () => controller.abort();
  }, [fetcher, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
