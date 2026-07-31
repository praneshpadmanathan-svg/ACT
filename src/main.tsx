import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './lib/pwa';

/* Fonts, served from our own origin.

   These used to come from Google Fonts over a <link> in index.html, which meant
   every visitor's IP address reached Google before the page had painted a
   single pixel. For a site whose audience is 13-to-17-year-olds, that is a
   third party learning something about a minor for no benefit to the minor.

   Self-hosting removes the request entirely, lets the Content-Security-Policy
   drop external style and font sources, and paints faster besides — no DNS
   lookup, no TLS handshake and no round trip to a second origin before any text
   can render. Latin subsets only, and only the weights the design uses. */
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource-variable/newsreader/opsz.css';

import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
