/* Wizzy — the guide.

   Context-aware: what he says depends on where you actually are in the
   climb, not a fixed carousel. He can be dismissed, and stays dismissed for
   the session, because a mascot you cannot silence becomes an irritant. */

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { readRaw, writeRaw } from '@/lib/storage';
import { useMapProgress } from './AdventureMap';
import { activeQuest, OATH_ECHO } from './story';
import { Art } from '@/components/Art';

const DISMISS_KEY = 'act-command:wizzy-hidden';

export function Wizzy() {
  const { progress } = useStore();
  const { current, cleared, total, allCleared } = useMapProgress();
  const quest = useMemo(() => activeQuest(progress, { cleared, total }), [progress, cleared, total]);
  const [hidden, setHidden] = useState(() => readRaw(DISMISS_KEY) === '1');
  const [tipIndex, setTipIndex] = useState(0);

  const tips = useMemo(() => {
    const list: string[] = [];

    /* The current objective leads, so Wizzy on the map is talking about the
       story rather than reciting generic advice beside it. */
    if (quest) {
      const left = Math.max(0, quest.need - quest.have);
      list.push(
        `<b>${quest.quest.name}.</b> ${quest.quest.objective} — ${quest.have} of ${quest.need}, ` +
          `${left === 1 ? 'one to go' : `${left} to go`}.`,
      );
      const seals = progress.achievements.filter((a) => a.startsWith('boss-')).length;
      if (seals > 0 && seals < 4) {
        list.push(
          `<b>${seals} of the four Seals</b> is broken. The guardians still standing know it, and they will not be careless.`,
        );
      }
    }

    if (allCleared) {
      list.push(
        'Every landmark is lit, traveller. The Grey has nothing left to hold between here and the water — sail to the citadel and sit the trial.',
      );
    } else if (cleared === 0) {
      list.push(
        `Greetings! I am Wizzy. Your road begins at <b>${current?.zone.name ?? 'the first landmark'}</b> — tap the glowing pin where your traveller stands.`,
      );
    } else {
      list.push(
        `Your next ground is <b>${current?.zone.name ?? 'the summit'}</b>. Tap the glowing pin and take it.`,
      );
    }

    list.push(
      'Each pin is one skill. Read the short lesson, then clear the quiz at 70% or better to open the next pin along the road.',
    );
    list.push(
      'Miss a question and it returns in <b>Review</b> — tomorrow, then in three days, then a week — until it truly sticks.',
    );

    // Call back to the prologue answer, so the guide remembers you.
    const echo = progress.oath ? OATH_ECHO[progress.oath] : null;
    if (echo && cleared > 0) {
      list.push(
        `When the road drags — and it will — remember ${echo}. That is what the climbing is for.`,
      );
    }

    if (progress.dayStreak >= 2) {
      list.push(
        `Your streak stands at <b>${progress.dayStreak} days</b>. Answer even one question today to keep it burning.`,
      );
    }
    list.push(
      'The citadel at the southern isle holds the timed trial and your predicted score. That is where the climb is measured.',
    );
    return list;
  }, [allCleared, cleared, current, quest, progress.achievements, progress.dayStreak, progress.oath]);

  const dismiss = () => {
    writeRaw(DISMISS_KEY, '1');
    setHidden(true);
  };

  const restore = () => {
    writeRaw(DISMISS_KEY, '0');
    setHidden(false);
    sfx.select();
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={restore}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border
                   border-gold-deep bg-leather-850/95 px-4 py-2.5 font-display text-[13px]
                   font-semibold text-gold shadow-card backdrop-blur transition-colors
                   hover:bg-leather-800"
      >
        <span aria-hidden="true">✦</span> Ask Wizzy
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-40 flex w-[min(370px,calc(100vw-2rem))] items-end gap-1"
      aria-label="Wizzy the guide"
    >
      <Art
        name="wizzy"
        sizes="(min-width: 640px) 92px, 74px"
        className="animate-float w-[74px] flex-none select-none sm:w-[92px]"
        style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.55))' }}
      />

      <div className="panel-lit relative mb-3 flex-1 px-4 py-3.5">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded
                     text-ink-faint transition-colors hover:text-parchment"
          aria-label="Hide Wizzy"
        >
          ✕
        </button>

        <div className="eyebrow mb-1.5">✦ Wizzy the Guide</div>
        <p
          className="font-read text-[14.5px] leading-relaxed text-parchment-dim"
          dangerouslySetInnerHTML={{ __html: tips[tipIndex % tips.length] }}
        />

        {tips.length > 1 && (
          <button
            type="button"
            onClick={() => {
              sfx.select();
              setTipIndex((i) => i + 1);
            }}
            className="mt-2.5 font-script text-[12px] uppercase tracking-[0.16em] text-gold
                       transition-colors hover:text-gold-bright"
          >
            More counsel ▸
          </button>
        )}
      </div>
    </aside>
  );
}
