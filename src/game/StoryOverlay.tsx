/* The story, played as a scene.

   Deliberately not a modal with a paragraph in it. Each line types itself
   out, tapping anywhere completes the line then advances, choices pause the
   scene until you answer, and the whole thing is framed as a chapter with a
   title card. It should feel like a game talking to you.

   Beats can ask for the scene to rattle as they open — soft for a tremor, hard
   for a Seal breaking, which also throws light through the shot. The shake is
   keyed to the beat rather than the line, and clears itself, so the text is
   never moving while you are trying to read it.

   Dispatches (the short between-chapter updates) render compact: no title
   card, a smaller Wizzy, and the eyebrow names the dispatch instead of him.

   Typing respects prefers-reduced-motion (lines appear whole), and every
   scene is skippable — a story you cannot skip becomes an obstacle on the
   second playthrough. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PATH_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { useRoute } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { REGION_ORDER } from './mapData';
import { nextChapter, type Chapter, type StoryChoice } from './story';

const TYPE_MS = 16;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Types a string out character by character. */
function useTypewriter(text: string, enabled: boolean) {
  const [shown, setShown] = useState(enabled ? '' : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      setDone(true);
      return;
    }
    setShown('');
    setDone(false);

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      // Don't stop mid-tag, or the markup flashes as literal text.
      let cut = i;
      const openTag = text.lastIndexOf('<', cut - 1);
      const closeTag = text.lastIndexOf('>', cut - 1);
      if (openTag > closeTag) cut = openTag;

      setShown(text.slice(0, cut));
      if (i >= text.length) {
        window.clearInterval(id);
        setShown(text);
        setDone(true);
      }
    }, TYPE_MS);

    return () => window.clearInterval(id);
  }, [text, enabled]);

  const finish = useCallback(() => {
    setShown(text);
    setDone(true);
  }, [text]);

  return { shown, done, finish };
}

/* The story plays on the adventure map and nowhere else.

   It used to be an exclusion list — everywhere except the landing, auth and
   onboarding — which meant chapters opened over the camp dashboard. An
   allowlist puts every beat over the world it is describing, and means a
   landmark you clear banks its beat until you step back out onto the map,
   which is where you were heading anyway. */
const STORY_ROUTES = new Set(['map']);

export function StoryOverlay() {
  const { progress, updateProgress } = useStore();
  const route = useRoute();

  /* Total landmarks is derived from content, so the chapter thresholds stay
     correct if zones are ever added. */
  const total = useMemo(
    () => REGION_ORDER.reduce((n, id) => n + (PATH_BY_ID[id]?.nodes.length ?? 0), 0),
    [],
  );
  const cleared = Object.keys(progress.zonesCleared).length;

  const dialogRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [showTitle, setShowTitle] = useState(true);

  const reduced = prefersReducedMotion();
  /* Focus goes into the scene while it is open — otherwise Tab walks the map
     behind it, 44 landmark pins deep, and nothing announces the dialog. */
  useDialogFocus(dialogRef, Boolean(chapter));

  /* Pick up whichever chapter has just been earned.

     Guarding only on "already playing" or "already scheduled" is enough: a
     finished chapter is written to `storySeen`, so `nextChapter` will not
     offer it twice. An earlier version also kept a "fired for this id" ref,
     which deadlocked under StrictMode — the simulated unmount cleared the
     pending timer while the ref still said it had fired, so the prologue
     never appeared. */
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    if (chapter || pendingRef.current !== null) return;
    if (!STORY_ROUTES.has(route.name)) return;
    const found = nextChapter(progress, { cleared, total });
    if (!found) return;

    // A short beat so whatever triggered it (a clear, a rank up) lands first.
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      setChapter(found);
      setBeatIndex(0);
      setLineIndex(0);
      setReply(null);
      setShowTitle(true);
      setClosing(false);
      sfx.page();
    }, 700);

    return () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, [chapter, progress, cleared, total, route.name]);

  const beat = chapter?.beats[beatIndex];
  const line = reply ?? beat?.lines[lineIndex] ?? '';
  const typing = useTypewriter(line, !reduced && !showTitle);

  /* Shake the scene as a beat opens, when the beat asks for it. Keyed on the
     beat so it fires once per beat rather than on every line, and cleared
     afterwards so the text is never moving while you are reading it — the
     global prefers-reduced-motion rule collapses these to nothing. */
  const [shake, setShake] = useState<'soft' | 'hard' | null>(null);
  useEffect(() => {
    if (!chapter || showTitle) return;
    const want = chapter.beats[beatIndex]?.shake ?? null;
    if (!want) {
      setShake(null);
      return;
    }
    setShake(want);
    if (want === 'hard') sfx.warn();
    const id = window.setTimeout(() => setShake(null), want === 'hard' ? 1100 : 550);
    return () => window.clearTimeout(id);
  }, [chapter, beatIndex, showTitle]);

  // Dismiss the title card after a moment. Dispatches have none.
  useEffect(() => {
    if (!chapter || !showTitle) return;
    if (chapter.compact) {
      setShowTitle(false);
      return;
    }
    const id = window.setTimeout(() => setShowTitle(false), 1500);
    return () => window.clearTimeout(id);
  }, [chapter, showTitle]);

  const close = useCallback(() => {
    if (!chapter) return;
    setClosing(true);
    const id = chapter.id;
    window.setTimeout(() => {
      updateProgress((p) => ({
        ...p,
        storySeen: p.storySeen.includes(id) ? p.storySeen : [...p.storySeen, id],
      }));
      setChapter(null);
    }, 340);
  }, [chapter, updateProgress]);

  const advance = useCallback(() => {
    if (!chapter || !beat) return;

    // First tap finishes the line rather than skipping it.
    if (!typing.done) {
      typing.finish();
      return;
    }
    sfx.tick();

    // Coming back from a choice reply: move to the next beat.
    if (reply) {
      setReply(null);
      if (beatIndex + 1 < chapter.beats.length) {
        setBeatIndex(beatIndex + 1);
        setLineIndex(0);
      } else {
        close();
      }
      return;
    }

    if (lineIndex + 1 < beat.lines.length) {
      setLineIndex(lineIndex + 1);
      return;
    }
    // Lines exhausted — a choice holds the scene here.
    if (beat.choice) return;

    if (beatIndex + 1 < chapter.beats.length) {
      setBeatIndex(beatIndex + 1);
      setLineIndex(0);
    } else {
      close();
    }
  }, [chapter, beat, typing, reply, lineIndex, beatIndex, close]);

  const answer = (choice: StoryChoice) => {
    sfx.achieve();
    updateProgress((p) => ({ ...p, oath: choice.value }));
    setReply(choice.reply);
  };

  // Keyboard: space/enter advances, escape skips the chapter.
  useEffect(() => {
    if (!chapter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target && ['BUTTON', 'INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapter, advance, close]);

  if (!chapter || !beat) return null;

  const atChoice = beat.choice && !reply && typing.done && lineIndex === beat.lines.length - 1;
  const totalLines = chapter.beats.reduce((n, b) => n + b.lines.length, 0);
  const linesSoFar =
    chapter.beats.slice(0, beatIndex).reduce((n, b) => n + b.lines.length, 0) + lineIndex + 1;

  return (
    <div
      ref={dialogRef}
      className={cx(
        'fixed inset-0 z-[120] flex items-center justify-center p-4',
        closing ? 'animate-storyOut' : 'animate-storyIn',
      )}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={`Story: ${chapter.title}`}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-leather-950/88 backdrop-blur-sm" />
      <img
        src="/art/camp-bg.webp"
        alt=""
        className="absolute inset-0 h-full w-full select-none object-cover opacity-25"
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(12,9,6,.85) 100%)' }}
      />

      {/* chapter title card */}
      {showTitle && (
        <div className="relative z-10 px-6 text-center">
          <div className="eyebrow animate-storyTitle">{chapter.eyebrow}</div>
          <h2
            className="heading mt-3 animate-storyTitle text-[clamp(1.9rem,5.5vw,3.2rem)] text-gold-light"
            style={{ animationDelay: '120ms' }}
          >
            {chapter.title}
          </h2>
          <div
            className="mx-auto mt-5 h-px w-40 animate-storyTitle bg-gradient-to-r from-transparent via-gold to-transparent"
            style={{ animationDelay: '240ms' }}
          />
        </div>
      )}

      {/* the scene */}
      {!showTitle && (
        <button
          type="button"
          onClick={advance}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label="Continue the story"
          tabIndex={-1}
        />
      )}

      {/* A hard beat throws light through the scene as it lands. */}
      {shake === 'hard' && (
        <div
          key={`flash-${beatIndex}`}
          className="pointer-events-none absolute inset-0 z-[15] animate-sealFlash"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(255,236,178,.55), transparent 62%)' }}
          aria-hidden="true"
        />
      )}

      {!showTitle && (
        <div
          className={cx(
            'relative z-20 w-full max-w-2xl',
            shake === 'hard' && 'animate-shakeHard',
            shake === 'soft' && 'animate-shakeSoft',
          )}
        >
          <div className="flex flex-col items-center gap-0 sm:flex-row sm:items-end sm:gap-4">
            <img
              src="/art/wizzy.webp"
              alt=""
              className={cx(
                'animate-storyWizzy flex-none select-none',
                chapter.compact
                  ? 'w-[72px] sm:w-[92px]'
                  : 'w-[96px] sm:w-[132px] lg:w-[150px]',
              )}
              style={{ filter: 'drop-shadow(0 10px 16px rgba(0,0,0,.6))' }}
              draggable={false}
            />

            <div className="story-card min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow">✦ {chapter.compact ? chapter.eyebrow : 'Wizzy the Guide'}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                  className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
                >
                  Skip ▸
                </button>
              </div>

              <p
                className="mt-3 min-h-[5.5em] font-read text-[clamp(1rem,2.1vw,1.2rem)] leading-relaxed text-parchment-dim sm:min-h-[4.5em]"
                dangerouslySetInnerHTML={{ __html: typing.shown }}
              />

              {/* choice */}
              {atChoice && beat.choice && (
                <div className="mt-4 animate-fadein">
                  <div className="label-sm mb-2.5">{beat.choice.prompt}</div>
                  <div className="grid gap-2">
                    {beat.choice.options.map((option, i) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          answer(option);
                        }}
                        className="story-choice animate-storyChoice"
                        style={{ animationDelay: `${i * 70}ms` }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* pacing dots + prompt */}
              {!atChoice && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    {Array.from({ length: totalLines }, (_, i) => (
                      <i
                        key={i}
                        className={cx(
                          'block h-1 rounded-full transition-all duration-300',
                          i < linesSoFar ? 'w-4 bg-gold' : 'w-1.5 bg-leather-700',
                        )}
                      />
                    ))}
                  </span>
                  <span
                    className={cx(
                      'font-script text-[12px] uppercase tracking-[0.16em]',
                      typing.done ? 'animate-shimmer text-gold' : 'text-ink-faint',
                    )}
                  >
                    {typing.done ? 'Tap to continue ▸' : 'Tap to skip'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
