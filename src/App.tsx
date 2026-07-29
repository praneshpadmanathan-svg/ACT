/* Route table and app shell composition. */

import { useEffect } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { useStore } from '@/lib/store';
import { TopBar } from '@/components/Shell';
import { ConfettiCanvas, LevelUpOverlay, Toasts, XPPopups } from '@/components/Feedback';
import { StoryOverlay } from '@/game/StoryOverlay';
import { Landing } from '@/screens/Landing';
import { Auth } from '@/screens/Auth';
import { Onboarding } from '@/screens/Onboarding';
import { Home } from '@/screens/Home';
import { MapScreen, PathScreen } from '@/screens/MapScreens';
import { ZoneScreen } from '@/screens/Zone';
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
    <>
      {!bare && <TopBar />}
      {renderRoute(route)}

      {/* Story runs above every screen so a chapter can fire wherever you
          happen to be when you earn it. */}
      {hasStarted && <StoryOverlay />}

      <ConfettiCanvas />
      <XPPopups />
      <Toasts />
      <LevelUpOverlay />
    </>
  );
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
