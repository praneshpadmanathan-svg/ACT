/* Catches render crashes and shows something recoverable instead of a white
   screen. The old build had no boundary at all, so one bad content string
   took the whole page down.

   Two of them now. The outer one, in main.tsx, sits above everything — the
   store included — and is the last resort. The inner one wraps each screen
   inside the store (App.tsx, `scope="screen"`), so a screen that throws takes
   only itself down: the navigation, the store and the student's session stay
   up, and moving to another screen replaces it. */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/report';
import { isChunkLoadError, reloadForNewBuild } from '@/lib/chunkReload';
import { clearDeviceData } from '@/lib/storage';
import { AGE_VERDICT_KEY } from '@/lib/ageGate';

interface Props {
  children: ReactNode;
  /** `app` is the outermost, full-page boundary; `screen` is one route's. */
  scope?: 'app' | 'screen';
}

interface State {
  error: Error | null;
  /** A stale-build reload is under way; show nothing alarming meanwhile. */
  reloading: boolean;
}

const CLEAR_CONFIRM =
  'Clear everything this app has saved in this browser?\n\n' +
  'If you are signed in, your progress is backed up to your account and comes back the next time the app loads. ' +
  'If you play as a guest, your progress on this device will be gone for good.\n\n' +
  'Your settings will go back to their defaults.';

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* A missing chunk after a deploy — a lazy screen, or a piece of the
       question bank thrown up by `useContent` — is fixed by loading the
       current build, not by anything on this panel. Reload once (the guard
       lives in chunkReload); if that was already tried, fall through and show
       the error like any other. */
    if (isChunkLoadError(error) && reloadForNewBuild()) {
      this.setState({ reloading: true });
      return;
    }
    reportError(
      'render',
      `${error.message}
${info.componentStack ?? ''}`.trim(),
    );
  }

  private retry = () => {
    /* A failed import is cached by React's `lazy` and by the browser, so
       re-rendering would meet the same rejection. Only a reload retries it. */
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  private toDashboard = () => {
    // Already there: no hash change will arrive to remount anything.
    if (this.props.scope === 'screen' && window.location.hash === '#/home') {
      this.retry();
      return;
    }
    window.location.hash = '#/home';
    /* Inside the store the hash change is enough: the route key changes and
       a fresh boundary mounts. Above it there is no store left to navigate
       with, so the page has to start again. */
    if (this.props.scope !== 'screen') window.location.reload();
  };

  private clearSaved = () => {
    if (!window.confirm(CLEAR_CONFIRM)) return;
    clearDeviceData([AGE_VERDICT_KEY]);
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    const { error, reloading } = this.state;
    if (reloading) {
      return (
        <p className="px-4 py-16 text-center text-[15px] text-parchment-dim">
          Loading the latest version…
        </p>
      );
    }
    if (!error) return this.props.children;

    const screen = this.props.scope === 'screen';

    return (
      <div
        className={
          screen
            ? 'flex items-center justify-center px-4 py-12'
            : 'flex min-h-dvh items-center justify-center px-4'
        }
      >
        <div className="panel w-full max-w-lg p-7 text-center sm:p-9">
          <h1 className="heading text-[15px] text-blood-text">Something broke</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-parchment-dim">
            {screen ? 'This screen' : 'The app'} failed to render. Your progress is saved — going
            back to the dashboard usually clears it.
          </p>

          <pre className="mt-5 max-h-40 overflow-auto rounded-lg border-2 border-leather-700 bg-leather-900 p-3 text-left font-mono text-[11px] leading-relaxed text-ink-faint">
            {error.message}
          </pre>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-ghost" onClick={this.retry}>
              Try again
            </button>
            <button type="button" className="btn btn-primary" onClick={this.toDashboard}>
              Back to dashboard
            </button>
          </div>

          {/* The way out when the saved data is itself what crashes. A record
              that fails to render fails again on every load, and the buttons
              above both lead straight back into it. */}
          <p className="mt-7 text-[13px] leading-relaxed text-ink-faint">
            Still broken after that?{' '}
            <button
              type="button"
              className="underline underline-offset-2 transition-colors hover:text-parchment"
              onClick={this.clearSaved}
            >
              Clear saved data on this device
            </button>
          </p>
        </div>
      </div>
    );
  }
}
