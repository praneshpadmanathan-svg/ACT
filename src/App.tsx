/* Route table and app shell composition. */

import { useEffect } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { useStore } from '@/lib/store';
import { m, MotionProvider, pageVariants } from '@/lib/motion';
import { TopBar } from '@/components/Shell';
import { ConfettiCanvas, LevelUpOverlay, Toasts, XPPopups } from '@/components/Feedback';
import { StoryOverlay } from '@/game/StoryOverlay';
import { Landing } from '@/screens/Landing';
import { Auth } from '@/screens/Auth';
import { Onboarding } from '@/screens/Onboarding';
import { Home } from '@/screens/Home';
import { MapScreen, PathScreen } from '@/screens/MapScreens';
import { ZoneScreen } from '@/screens/Zone';
import { BossScreen } from '@/screens/Boss';
import { NoteReader, NotesScreen } from '@/screens/Notes';
import { DrillRunner, DrillsScreen, ReviewScreen } from '@/screens/Drills';
import { ReportScreen, TestRunner, TestsScreen } from '@/screens/Tests';
import { ProfileScreen, StatsScreen } from '@/screens/Stats';

/** Routes that render their own full-screen chrome and suppress the top bar.
 *  The map is here because it is a full-viewport game view with its own
 *  floating controls — a nav bar over it broke the immersion. */
const BARE_ROUTES = new Set(['landing', 'auth', 'onboarding', 'map']);

export default function App() {
  const route = useRoute();
  const navigate = useNavigate();
  const { authReady, userId, isGuest, identity, progress } = useStore();

  /* 'Started' means any of: a cloud account, a device account, guest mode, or
     existing progress. Missing the local-account case sent anyone who made an
     account on this device straight back to the front door. */
  const hasStarted =
    Boolean(userId) || identity.kind === 'local' || isGuest || progress.xp > 0;

  /* The landing page is the front door and stays reachable: it greets you
     every time you open the app, and shows 'Continue your quest' once there is
     progress to continue. Only the inner screens require having started. */
  useEffect(() => {
    if (!authReady) return;

    if (!hasStarted && !BARE_ROUTES.has(route.name)) {
      navigate({ name: 'landing' }, { replace: true });
      return;
    }
  }, [authReady, hasStarted, route.name, progress.profile, navigate]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-shimmer font-display text-[13px] uppercase text-gold">Loading…</div>
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

      <ConfettiCanvas />
      <XPPopups />
      <Toasts />
      <LevelUpOverlay />
    </MotionProvider>
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
