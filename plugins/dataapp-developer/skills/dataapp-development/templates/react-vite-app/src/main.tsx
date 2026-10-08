import React, { Component } from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';

import { App } from './App';

// Global error handlers live in index.html (inline <script>) so they catch
// module-level errors that fire before ES module bodies execute.
// The error boundary below covers React render errors; componentDidCatch
// forwards to the same global notifier exposed by the inline script.

declare global {
  // Set by the inline script in index.html.
  // eslint-disable-next-line no-var
  var __kaiNotifyError: ((msg: string) => void) | undefined;
  // Set to true by the ErrorBoundary below when a render crash surfaces the
  // fallback UI. The readiness detectors (vite.config.ts / index.html) check
  // this before posting `kai-preview-healthy`, so a crashed app that only
  // mounted its "Something went wrong" fallback is never reported healthy.
  // eslint-disable-next-line no-var
  var __kaiPreviewCrashed: boolean | undefined;
}

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Set the crash flag here (render phase) rather than in componentDidCatch:
    // this runs before React commits the fallback DOM, so the flag is guaranteed
    // set before the readiness detector's MutationObserver can observe the
    // fallback children and (wrongly) report the preview healthy.
    window.__kaiPreviewCrashed = true;
    return { error };
  }

  componentDidCatch(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    window.__kaiNotifyError?.(msg || 'Unknown error');
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white p-8">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-700">Something went wrong</p>
            <p className="mt-1 text-sm text-slate-500">The application encountered an error.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
