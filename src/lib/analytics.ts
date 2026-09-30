/* Visitor counts, via Vercel Web Analytics.

   Cookieless and first-party: the script and its beacon are both served from
   our own origin under /_vercel/insights, so the Content-Security-Policy needs
   no new source and no third party sees the visitor's IP. It records page
   views, country, device type and referrer. It identifies nobody, and it runs
   only in the production build.

   Every URL is reduced to the screen's name before it leaves the page. The
   router is hash-based, and Supabase delivers password-reset and confirmation
   sessions in the hash (#access_token=…), so sending the address as-is would
   ship a login token to the analytics store. Reducing to the route name also
   keeps test and report ids out of it. */

import { inject, pageview } from '@vercel/analytics';
import { parseRoute, type Route } from './router';

const pathFor = (route: Route): string => `/${route.name}`;

let started = false;

export function startAnalytics(): void {
  if (started || !import.meta.env.PROD) return;
  started = true;
  inject({
    mode: 'production',
    /* The router changes the hash, which the script's own pushState tracking
       does not see; `trackScreen` below reports each screen instead. */
    disableAutoTrack: true,
    beforeSend: (event) => ({
      ...event,
      url: `${window.location.origin}${pathFor(parseRoute())}`,
    }),
  });
}

let lastPath = '';

/** Report a screen view. Repeats of the same screen are dropped, so a
 *  re-render or a query-string change is not counted twice. */
export function trackScreen(route: Route): void {
  if (!started) return;
  const path = pathFor(route);
  if (path === lastPath) return;
  lastPath = path;
  pageview({ route: path, path });
}
