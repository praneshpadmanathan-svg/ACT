/* Catches render crashes and shows something recoverable instead of a white
   screen. The old build had no boundary at all, so one bad content string
   took the whole page down. */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ACT Command] render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-lg p-7 text-center sm:p-9">
          <h1 className="heading text-[15px] text-blood-text">Something broke</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-parchment-dim">
            The screen failed to render. Your progress is saved — going back to the dashboard usually
            clears it.
          </p>

          <pre className="mt-5 max-h-40 overflow-auto rounded-lg border-2 border-leather-700 bg-leather-900 p-3 text-left font-mono text-[11px] leading-relaxed text-ink-faint">
            {error.message}
          </pre>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                window.location.hash = '#/home';
                window.location.reload();
              }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
