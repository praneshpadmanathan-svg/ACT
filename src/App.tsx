/* Route table and app shell composition. */

import { useEffect, useState } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { useStore } from '@/lib/store';
import { onUpdateReady } from '@/lib/pwa';
import { m, MotionProvider, pageVariants } from '@/lib/motion';
import { TopBar } from '@/components/Shell';
import { ConfettiCanvas, LevelUpOverlay, Toasts, XPPopups } from '@/components/Feedback';
import { StoryOverlay } from '@/game/StoryOverlay';
import { Landing } from '@/screens/Landing';
import { Auth } from '@/screens/Auth';
import { LegalScreen } from '@/screens/Legal';
import { ExplainScreen } from '@/screens/Explain';
import { Onboarding } from '@/screens/Onboarding';
import { Home } from '@/screens/Home';
import { MapScreen, PathScreen } from '@/screens/MapScreens';
import { ZoneScreen } from '@/screens/Zone';
import { BossScreen } from '@/screens/Boss';
import { NoteReader, NotesScreen } from '@/screens/Notes';
import {
  BookmarksScreen,
  DailyScreen,
  DrillRunner,
  DrillsScreen,
  ReviewScreen,
} from '@/screens/Drills';
import { DiagnosticScreen } from '@/screens/Diagnostic';
import { ReportScreen, TestRunner, TestsScreen } from '@/screens/Tests';
import { ProfileScreen, StatsScreen } from '@/screens/Stats';
import { Vignette } from '@/components/Vignette';

/** Routes that render their own full-screen chrome and suppress the top bar.
 *  The map is here because it is a full-viewport game view with its own
 *  floating controls — a nav bar over it broke the immersion. */
const BARE_ROUTES = new Set(['landing', 'auth', 'onboarding', 'map', 'privacy', 'terms', 'faq']);

/** Reachable without having started: the front door, everything legal, and the
 *  page that explains what the ACT is — which is no use at all behind a flow
 *  you have to enter before you can read it. */
const OPEN_ROUTES = new Set(['landing', 'auth', 'privacy', 'terms', 'faq', 'onboarding']);

export default function App() {
  const route = useRoute();
  const navigate = useNavigate();
  const { authReady, hasStarted, progress, authRedirect, clearAuthRedirect } = useStore();

  /* A reset link puts a live session in place and then has to be *used*, so it
     jumps the queue: whatever the URL said, the next thing on screen is the
     form for choosing a new password. */
  useEffect(() => {
    if (authRedirect?.flow !== 'reset') return;
    if (route.name === 'auth' && route.mode === 'reset') return;
    navigate({ name: 'auth', mode: 'reset' }, { replace: true });
  }, [authRedirect, route, navigate]);

  /* The landing page is the front door and stays reachable: it greets you
     every time you open the app, and shows 'Continue your quest' once there is
     progress to continue. Only the inner screens require having started.

     Onboarding is decided here rather than at the end of signing in, because
     the progress belonging to a just-adopted identity arrives through a state
     update that has not landed while the auth screen is still deciding where to
     go. One place, one rule, no race. */
  useEffect(() => {
    if (!authReady) return;

    if (!hasStarted && !OPEN_ROUTES.has(route.name)) {
      navigate({ name: 'landing' }, { replace: true });
      return;
    }
    if (hasStarted && !progress.profile && !OPEN_ROUTES.has(route.name)) {
      navigate({ name: 'onboarding' }, { replace: true });
    }
  }, [authReady, hasStarted, route.name, progress.profile, navigate]);

  /* Confirming your email has to *arrive* somewhere.

     The link comes back to `/?flow=confirm`, which carries no hash, so the
     router read it as the landing route — and landing is reachable without
     having started, so nothing moved you on. You clicked the link in your
     inbox, got signed in, and were shown the marketing page with a "Begin"
     button, as though the last two minutes had not happened. Now the session
     that link created is used: straight into the app. */
  useEffect(() => {
    if (authRedirect?.flow !== 'confirm' || !authRedirect.ok) return;
    clearAuthRedirect();
    if (route.name === 'landing' || route.name === 'auth') {
      navigate({ name: progress.profile ? 'home' : 'onboarding' }, { replace: true });
    }
  }, [authRedirect, clearAuthRedirect, route.name, progress.profile, navigate]);

  if (!authReady) {
    /* The cold-start screen. It was the word "Loading…" on a dark field —
       the one screen every single visitor sees, and the only one with no art
       on it at all. A compass whose needle is actually turning says the same
       thing, in the world's own voice, and tells you the app has not hung.

       `role="status"` because a sighted user gets the spinning needle and a
       screen-reader user was getting nothing. */
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
        <Vignette name="compass" size={120} />
        <div className="animate-shimmer font-script text-[11px] uppercase tracking-[0.18em] text-gold">
          Finding your place
        </div>
      </div>
    );
  }

  const bare = BARE_ROUTES.has(route.name);

  return (
    <MotionProvider>
      {!bare && <TopBar />}

      {/* Screens animate in, and nothing waits on an animation to do it.

          This started as AnimatePresence with mode="wait" so the outgoing
          screen could animate away first. That gates mounting the next screen
          on the previous one's exit *completing* — and Motion is driven by
          requestAnimationFrame, which browsers stop entirely in a hidden tab.
          Navigate, switch tabs, come back, and the app is still showing the
          old screen with no way forward. Verified: in a hidden tab rAF fires
          zero frames per second and the exit never finishes.

          So the key remounts the wrapper and it animates in, unconditionally.
          The cost is losing a 160ms fade on the way out; the gain is that a
          decorative animation can never hold the app hostage. The key is the
          route identity rather than just its name, so paging between two note
          pages re-animates too. The map is excluded: it owns the viewport and
          brings its own artwork in. */}
      {route.name === 'map' ? (
        renderRoute(route)
      ) : (
        <m.div key={routeKey(route)} variants={pageVariants} initial="initial" animate="animate">
          {renderRoute(route)}
        </m.div>
      )}

      {/* Story runs above every screen so a chapter can fire wherever you
          happen to be when you earn it. */}
      {hasStarted && <StoryOverlay />}

      <UpdatePrompt />
      <ConfettiCanvas />
      <XPPopups />
      <Toasts />
      <LevelUpOverlay />
    </MotionProvider>
  );
}

/* A newer build is installed and waiting.

   Offered rather than applied. Reloading on its own would be fine on the map
   and unforgivable eleven minutes into a timed section, and the service worker
   cannot tell the difference — so the person does. */
function UpdatePrompt() {
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => onUpdateReady((run) => setApply(() => run)), []);

  if (!apply) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[130] flex justify-center p-4">
      <div className="panel-lit flex flex-wrap items-center gap-3 px-4 py-3 shadow-lg">
        <span className="font-read text-[14px] text-parchment-dim">A new version is ready.</span>
        <button
          type="button"
          onClick={apply}
          className="font-display text-[13px] font-semibold text-gold transition-colors hover:text-gold-bright"
        >
          Reload now
        </button>
        <button
          type="button"
          onClick={() => setApply(null)}
          className="font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
        >
          Later
        </button>
      </div>
    </div>
  );
}

/** Identity of the current screen, so a change of parameter transitions too. */
function routeKey(route: ReturnType<typeof useRoute>): string {
  const r = route as Record<string, unknown>;
  const detail = r.section ?? r.zone ?? r.page ?? r.topic ?? r.id ?? r.mode ?? '';
  return `${route.name}:${String(detail)}`;
}

function renderRoute(route: ReturnType<typeof useRoute>) {
  switch (route.name) {
    case 'landing':
      return <Landing />;
    case 'auth':
      return <Auth mode={route.mode} />;
    case 'privacy':
      return <LegalScreen page="privacy" />;
    case 'terms':
      return <LegalScreen page="terms" />;
    case 'faq':
      return <ExplainScreen />;
    case 'onboarding':
      return <Onboarding />;
    case 'home':
      return <Home />;
    case 'map':
      return <MapScreen />;
    case 'path':
      return <PathScreen section={route.section} />;
    case 'zone':
      return <ZoneScreen zoneId={route.zone} />;
    case 'boss':
      return <BossScreen section={route.section} />;
    case 'notes':
      return <NotesScreen section={route.section} />;
    case 'note':
      return <NoteReader pageId={route.page} />;
    case 'drills':
      return <DrillsScreen section={route.section} />;
    case 'drill':
      return <DrillRunner section={route.section} topic={route.topic} />;
    case 'review':
      return <ReviewScreen />;
    case 'bookmarks':
      return <BookmarksScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'diagnostic':
      return <DiagnosticScreen />;
    case 'tests':
      return <TestsScreen />;
    case 'test':
      return <TestRunner config={route.config} />;
    case 'report':
      return <ReportScreen id={route.id} />;
    case 'stats':
      return <StatsScreen />;
    case 'profile':
      return <ProfileScreen />;
    default:
      return <Home />;
  }
}
