/* Route table and app shell composition. */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { useStore } from '@/lib/store';
import { onUpdateReady } from '@/lib/pwa';
import { m, MotionProvider, pageVariants } from '@/lib/motion';
import { TopBar } from '@/components/Shell';
import { ConfettiCanvas, LevelUpOverlay, Toasts, XPPopups } from '@/components/Feedback';
import { StoryOverlay } from '@/game/StoryOverlay';
import { Vignette } from '@/components/Vignette';
import loadingScene from '@/sceneArt.json';

/* The front door, and only the front door.
 *
 * Everything below this line is fetched when it is first needed. Landing is
 * not, because it is what a stranger sees before they have decided anything:
 * putting a spinner in front of the page that has to persuade them is a worse
 * trade than any number of kilobytes. */
import { Landing } from '@/screens/Landing';

/* ------------------------------------------------------- the other screens
 *
 * Every screen in the app used to be a static import, which meant one 543 kB
 * chunk containing the map, the duel, the score report and the privacy policy
 * — downloaded in full by someone who came to read the FAQ and left.
 *
 * The loaders are named so `prefetch` below can call the same function the
 * lazy component will call. A module is only ever fetched once; the second
 * call resolves out of the module cache, so warming a screen during idle time
 * makes the navigation that follows instant rather than duplicating work.
 *
 * `.then(m => ({ default: … }))` on each because these are named exports and
 * `lazy` wants a default. Written out one per line rather than through a
 * generic helper: the explicit form keeps each screen's real props type, and a
 * helper returning `ComponentType<any>` would quietly stop checking the eleven
 * screens that take parameters off the route. */
const load = {
  auth: () => import('@/screens/Auth'),
  legal: () => import('@/screens/Legal'),
  explain: () => import('@/screens/Explain'),
  onboarding: () => import('@/screens/Onboarding'),
  home: () => import('@/screens/Home'),
  mapScreens: () => import('@/screens/MapScreens'),
  zone: () => import('@/screens/Zone'),
  boss: () => import('@/screens/Boss'),
  notes: () => import('@/screens/Notes'),
  drills: () => import('@/screens/Drills'),
  diagnostic: () => import('@/screens/Diagnostic'),
  tests: () => import('@/screens/Tests'),
  stats: () => import('@/screens/Stats'),
};

const Auth = lazy(() => load.auth().then((m) => ({ default: m.Auth })));
const LegalScreen = lazy(() => load.legal().then((m) => ({ default: m.LegalScreen })));
const ExplainScreen = lazy(() => load.explain().then((m) => ({ default: m.ExplainScreen })));
const Onboarding = lazy(() => load.onboarding().then((m) => ({ default: m.Onboarding })));
const Home = lazy(() => load.home().then((m) => ({ default: m.Home })));
const MapScreen = lazy(() => load.mapScreens().then((m) => ({ default: m.MapScreen })));
const PathScreen = lazy(() => load.mapScreens().then((m) => ({ default: m.PathScreen })));
const ZoneScreen = lazy(() => load.zone().then((m) => ({ default: m.ZoneScreen })));
const BossScreen = lazy(() => load.boss().then((m) => ({ default: m.BossScreen })));
const NotesScreen = lazy(() => load.notes().then((m) => ({ default: m.NotesScreen })));
const NoteReader = lazy(() => load.notes().then((m) => ({ default: m.NoteReader })));
const DrillsScreen = lazy(() => load.drills().then((m) => ({ default: m.DrillsScreen })));
const DrillRunner = lazy(() => load.drills().then((m) => ({ default: m.DrillRunner })));
const ReviewScreen = lazy(() => load.drills().then((m) => ({ default: m.ReviewScreen })));
const BookmarksScreen = lazy(() => load.drills().then((m) => ({ default: m.BookmarksScreen })));
const DailyScreen = lazy(() => load.drills().then((m) => ({ default: m.DailyScreen })));
const DiagnosticScreen = lazy(() =>
  load.diagnostic().then((m) => ({ default: m.DiagnosticScreen })),
);
const TestsScreen = lazy(() => load.tests().then((m) => ({ default: m.TestsScreen })));
const TestRunner = lazy(() => load.tests().then((m) => ({ default: m.TestRunner })));
const ReportScreen = lazy(() => load.tests().then((m) => ({ default: m.ReportScreen })));
const StatsScreen = lazy(() => load.stats().then((m) => ({ default: m.StatsScreen })));
const ProfileScreen = lazy(() => load.stats().then((m) => ({ default: m.ProfileScreen })));

/** Routes that render their own full-screen chrome and suppress the top bar.
 *  The map is here because it is a full-viewport game view with its own
 *  floating controls — a nav bar over it broke the immersion. */
const BARE_ROUTES = new Set(['landing', 'auth', 'onboarding', 'map', 'privacy', 'terms', 'faq']);

/** Reachable without having started: the front door, everything legal, and the
 *  page that explains what the ACT is — which is no use at all behind a flow
 *  you have to enter before you can read it. */
const OPEN_ROUTES = new Set(['landing', 'auth', 'privacy', 'terms', 'faq', 'onboarding']);

/* Warm the everyday screens once the browser has nothing better to do.
 *
 * Splitting without this trades one slow first paint for a stall on every
 * navigation, which is not obviously a better deal. The chunks below are the
 * ones the top bar links to, so they are wanted within a click or two of
 * arriving; fetching them during idle time means the click finds them already
 * in the module cache.
 *
 * Gated on having started, because a stranger reading the FAQ should not have
 * the whole game pulled down behind them. `requestIdleCallback` where it
 * exists (not Safari), a timeout where it does not — either way this must
 * never compete with the screen the person is actually looking at. */
function prefetchEverydayScreens() {
  const warm = () => {
    void load.home();
    void load.mapScreens();
    void load.drills();
    void load.notes();
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (idle) idle(warm);
  else window.setTimeout(warm, 2000);
}

/* What a screen looks like while its chunk is in flight.
 *
 * Deliberately quiet and deliberately tall. A short fallback collapses the
 * page to nothing and then pushes it back, which reads as a glitch even when
 * the chunk arrives in 40ms; holding roughly a screen's height means the swap
 * is a fade rather than a jump. On a warm cache — which is every visit after
 * the first, and every visit at all once the service worker has precached the
 * build — this is on screen for a single frame or not at all. */
function ScreenFallback() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Loading"
    >
      <Vignette name="compass" size={84} />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const navigate = useNavigate();
  const { authReady, hasStarted, progress, authRedirect, clearAuthRedirect } = useStore();

  useEffect(() => {
    if (hasStarted) prefetchEverydayScreens();
  }, [hasStarted]);

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
    /* The cold-start screen — the one screen every single visitor sees.

       It has been three things. First the word "Loading…" on a dark field.
       Then a drawn compass with "Finding your place" under it, which was
       better and still had the problem that sank it: a caption explaining a
       loading screen is a caption nobody wants to read twice, and this one
       greets you before you have done anything at all.

       Now it is one painted object and no words. A lit lantern beside an open
       compass says *waiting, in this world* without asking to be read, and the
       breathing animation carries the "not hung" signal the turning needle used
       to carry.

       The copy is gone from the screen, not from the accessibility tree.
       `role="status"` with nothing in it announces nothing, so a screen-reader
       user would have been handed silence — which is precisely the failure the
       caption was added to fix. It moves to `sr-only` instead. */
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center" role="status">
        <img
          src={loadingScene.loading.src}
          width={loadingScene.loading.width}
          height={loadingScene.loading.height}
          alt=""
          decoding="async"
          draggable={false}
          className="animate-float w-[min(58vw,260px)] select-none"
          style={{ filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.55))' }}
        />
        <span className="sr-only">Loading</span>
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
      {/* One boundary around the route, keyed with it. Keying matters: without
          it React keeps the boundary mounted across a navigation and reuses
          the previous screen as the fallback's sibling, so moving from a long
          page to a lazy one leaves the old page on screen until the new chunk
          lands. Keyed, the fallback shows immediately and the transition is
          honest about what is happening. */}
      {route.name === 'map' ? (
        <Suspense fallback={<ScreenFallback />}>{renderRoute(route)}</Suspense>
      ) : (
        <m.div key={routeKey(route)} variants={pageVariants} initial="initial" animate="animate">
          <Suspense fallback={<ScreenFallback />}>{renderRoute(route)}</Suspense>
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
