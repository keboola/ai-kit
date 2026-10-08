import { useCallback, useEffect, useState } from 'react';

export type UseFetchResult<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
};

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = 500;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    function onAbort() {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort);
  });
}

export function useFetch<T>(url: string, init?: RequestInit): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          try {
            await delay(BACKOFF_MS, controller.signal);
          } catch {
            return;
          }
          if (cancelled) return;
        }
        try {
          const response = await fetch(url, { ...init, signal: controller.signal });
          const contentType = response.headers.get('content-type') ?? '';
          if (!response.ok || contentType.includes('text/html')) {
            lastError = new Error(
              `fetch ${url} -> ${response.status} ${response.statusText || contentType}`,
            );
            continue;
          }
          const body = (await response.json()) as T;
          if (cancelled) return;
          setData(body);
          setError(null);
          setLoading(false);
          return;
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') return;
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
      if (cancelled) return;
      setError(lastError ?? new Error(`fetch ${url} failed after ${MAX_ATTEMPTS} attempts`));
      setLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // init intentionally not in deps — caller must memoize non-trivial init objects
    // (documented in SKILL.md). Adding it would refetch on every render for callers
    // that pass an inline {method, body} object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refetch };
}
