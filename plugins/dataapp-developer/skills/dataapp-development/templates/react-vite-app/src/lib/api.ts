import { QueryClient } from '@tanstack/react-query';

/** The API is not up yet (`tsx watch` restarting, container starting): the answer is not JSON. */
export class RestartingError extends Error {}

/**
 * Fetches an `/api/*` route and parses its JSON.
 *
 * - Throws `RestartingError` for a network error or a non-JSON answer (the Vite proxy's 500
 *   `text/plain`, nginx's 502 page) — the query client retries it.
 * - Throws the API's `{ error }` message otherwise — final, so a failing query is not re-run.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new RestartingError(err instanceof Error ? err.message : String(err));
  }
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new RestartingError(`${url} -> ${response.status}`);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message ?? `${url} -> ${response.status}`);
  }
  return body as T;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 0.5 s, 1 s, 2 s, 4 s, 4 s, 4 s — covers a `tsx watch` restart and a cold container.
      retry: (failures, error) => error instanceof RestartingError && failures < 6,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      // Every refetch is a warehouse query: keep results for 5 minutes, ignore window focus.
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
