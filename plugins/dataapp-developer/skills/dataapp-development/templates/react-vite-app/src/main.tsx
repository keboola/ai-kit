import { Component, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import './index.css';

import { App } from './App';
import { queryClient } from './lib/api';

declare global {
  interface Window {
    /** Set by preview-signal.js: reports an error to Keboola's app preview. */
    __kaiNotifyError?: (message: string) => void;
    /** Set on a render crash, so the preview is never told the app is healthy. */
    __kaiPreviewCrashed?: boolean;
  }
}

/** Shows a fallback on a render crash and reports it to the preview. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    // Set before React commits the fallback, so the preview signal never sees it as a rendered app.
    window.__kaiPreviewCrashed = true;
    return { error };
  }

  componentDidCatch(error: unknown) {
    window.__kaiNotifyError?.(error instanceof Error ? error.message : String(error));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium">Something went wrong</p>
          <p className="mt-1 text-sm text-slate-500">The application encountered an error.</p>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
