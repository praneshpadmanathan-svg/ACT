import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';
import { PrefsProvider, applyStoredPrefs } from './lib/prefs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorReporting } from './lib/report';
import { registerServiceWorker } from './lib/pwa';

/* Fonts, served from our own origin.

   These used to come from Google Fonts over a <link> in index.html, which meant
   every visitor's IP address reached Google before the page had painted a
   single pixel. For a site whose audience is 13-to-17-year-olds, that is a
   third party learning something about a minor for no benefit to the minor.

   Self-hosting removes the request entirely, lets the Content-Security-Policy
   drop external style and font sources, and paints faster besides — no DNS
   lookup, no TLS handshake and no round trip to a second origin before any text
   can render. Latin subsets only, and only the weights the design uses.

   IM Fell English SC used to be imported here for the `font-script` role and
   is gone: it was a second serif display face doing the same job as Cinzel,
   and four families to render one app's worth of text was one too many. Cinzel
   holds both roles now — see the note in tailwind.config.js. */
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource-variable/newsreader/opsz.css';

import './index.css';

/* Catch `unhandledrejection` and `error`, and route both — along with the
   eleven console.warn sites scattered through the app — into one reporter.
   See lib/report.ts for what it does with them and why it is not Sentry. */
installErrorReporting();

/* Paint in the right theme on the first frame.

   This runs before `createRoot`, so `<html data-theme>` and `--text-scale`
   are already set when the browser computes the initial style. Doing it in a
   React effect instead would paint the default dark theme first and correct
   it a frame later — a flash of exactly the thing the person turned off. */
applyStoredPrefs();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <PrefsProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </PrefsProvider>
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
