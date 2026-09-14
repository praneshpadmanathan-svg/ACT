import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { LIBRARY_STATS } from '@/content/stats';
import { RealmScene } from './RealmScene';

export function RealmOpening() {
  const { continueAsGuest, progress, hasStarted, playerName } = useStore();
  const navigate = useNavigate();
  const returning = hasStarted && Boolean(progress.profile);
  const begin = () => {
    sfx.achieve();
    if (!hasStarted) continueAsGuest();
    navigate({ name: progress.profile ? 'home' : 'onboarding' });
  };
  return (
    <RealmScene art="realm-opening-v2" className="realm-opening">
      <div className="realm-opening-content shell">
        <div className="realm-kicker">
          <span /> A little practice. A grand adventure.
        </div>
        <h1>
          {returning ? (
            <>
              Your world
              <br />
              is waiting<span>, {playerName}.</span>
            </>
          ) : (
            <>
              A brighter mind.
              <br />
              <em>
                A world of
                <br className="realm-mobile-break" /> possibility.
              </em>
            </>
          )}
        </h1>
        <p>
          Follow your curiosity through an enchanted world. Learn a skill, bring a landmark to life,
          and make your next ACT milestone an adventure.
        </p>
        <div className="realm-actions">
          <button className="realm-button" onClick={begin}>
            {returning ? 'Continue your journey' : 'Begin your adventure'}{' '}
            <span aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            className="realm-text-link"
            onClick={() =>
              document.getElementById('realm-preview')?.scrollIntoView({ block: 'start' })
            }
          >
            Discover the world <span aria-hidden="true">↓</span>
          </button>
        </div>
        <div className="realm-opening-proof">
          <span>Free to explore</span>
          <i /> <span>No account needed</span>
          <i />
          <span>Made for your ACT journey</span>
        </div>
      </div>
      <div className="realm-scene-caption" aria-hidden="true">
        <span className="realm-compass">✧</span>
        <div>
          <small>Somewhere beyond the familiar</small>
          <span>Your next chapter awaits</span>
        </div>
      </div>
      <div className="realm-world-strip" id="realm-preview">
        <div>
          <b>01 — EXPLORE</b>
          <span>Four extraordinary regions</span>
        </div>
        <div>
          <b>02 — DISCOVER</b>
          <span>{LIBRARY_STATS.zones} landmarks to bring to life</span>
        </div>
        <div>
          <b>03 — BECOME</b>
          <span>Every small win changes your world</span>
        </div>
      </div>
    </RealmScene>
  );
}
