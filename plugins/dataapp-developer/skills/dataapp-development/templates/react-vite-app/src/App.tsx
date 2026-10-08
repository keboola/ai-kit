import { useEffect, useState } from 'react';

type Health = { ok: boolean; mode: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-8">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-3xl font-semibold text-slate-900">Keboola data app</h1>
        <p className="mt-2 text-slate-600">
          React + Vite + Tailwind + Express template. Replace this component with your dashboard.
        </p>
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm">
          <span className="font-medium text-slate-700">API health:</span>{' '}
          {error ? (
            <span className="text-rose-600">{error}</span>
          ) : health ? (
            <span className="text-emerald-700">ok ({health.mode})</span>
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
