import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './lib/api.ts';

type Health = { ok: boolean; mode: string };

export function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchJson<Health>('/api/health', { signal }),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-8">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-3xl font-semibold text-kbc-text">Keboola data app</h1>
        <p className="mt-2 text-slate-600">
          React + Vite + Tailwind + Express template. Replace this component with your dashboard.
        </p>
        <div className="mt-6 rounded-lg bg-kbc-bg-alt p-4 text-sm">
          <span className="font-medium text-slate-700">API health:</span>{' '}
          {health.error ? (
            <span className="text-rose-600">{health.error.message}</span>
          ) : health.data ? (
            <span className="text-emerald-700">ok ({health.data.mode})</span>
          ) : (
            <span className="text-slate-500">loading…</span>
          )}
        </div>
      </div>
      <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 opacity-80 transition-opacity hover:opacity-100">
        <span>Powered by</span>
        <img src="/keboola-logo.svg" alt="Keboola" className="h-4 w-auto" />
      </footer>
    </main>
  );
}
