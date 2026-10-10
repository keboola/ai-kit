import { QueryClient } from '@tanstack/react-query';

/** The API is not up: a network error, or 502-504 while it starts or restarts (`node --watch`). */
export class RestartingError extends Error {}

/**
 * Fetches an `/api/*` route and parses its JSON.
 *
 * - Throws `RestartingError` while the API is not up — the query client retries it.
 * - Throws the API's `{ error }` message otherwise — final, so a failing query is not re-run.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new RestartingError(String(err));
  });
  if ([502, 503, 504].includes(response.status)) {
    throw new RestartingError(`${url} -> ${response.status}`);
  }
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `${url} -> ${response.status}`);
  return body as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 0.5 s, 1 s, 2 s, 4 s, 4 s, 4 s — covers a `node --watch` restart and a cold container.
      retry: (failures, error) => error instanceof RestartingError && failures < 6,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      // Every refetch is a warehouse query: keep results for 5 minutes, ignore window focus.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
