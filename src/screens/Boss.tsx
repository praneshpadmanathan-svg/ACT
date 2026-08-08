/* The boss duel.

   You on the left, the boss on the right, questions in between. A correct
   answer lands a hit; a wrong one lets the boss hit back. Health bars on
   both sides, and the fight ends when one of you runs out.

   Losing costs nothing but the attempt — no XP is taken away and no zone is
   re-locked. A boss that could set you back would just teach people to avoid
   it, which is the opposite of what it is for. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PATH_BY_ID, QUESTIONS, SECTION_BY_ID } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { fromDrillQuestion } from '@/lib/normalize';
import { XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { cx, shuffle } from '@/lib/utils';
import type { Question, SectionId } from '@/types';
import { BackLink, Page } from '@/components/Shell';
import { Button, EmptyState } from '@/components/ui';
import { RichText } from '@/components/RichText';
import { burstConfetti } from '@/components/Feedback';
import { BossArt, type BossState } from '@/game/BossArt';
import { bossFor } from '@/game/bosses';
import { REGIONS } from '@/game/mapData';
import { m, SPRING_SNAP } from '@/lib/motion';
import { Art } from '@/components/Art';

type Phase = 'intro' | 'fight' | 'won' | 'lost';

export function BossScreen({ section }: { section: string }) {
  const navigate = useNavigate();
  const { progress, answerQuestion, updateProgress } = useStore();

  const sectionId = section as SectionId;
  const boss = bossFor(sectionId);
  const meta = SECTION_BY_ID[sectionId];
  const region = REGIONS[sectionId];
  const path = PATH_BY_ID[sectionId];

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [bossHp, setBossHp] = useState(boss?.health ?? 10);
  const [playerHp, setPlayerHp] = useState(boss?.playerHealth ?? 3);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [bossState, setBossState] = useState<BossState>('idle');
  const [heroHurt, setHeroHurt] = useState(false);
  const [hitStop, setHitStop] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  /* Hit-stop.

     When a blow lands, everything in the arena stops dead for a few frames.
     It is the oldest trick in fighting games and it is almost free: no new
     artwork, no particles, just the absence of motion at the one moment the
     eye is already looking. A hit that plays through at a constant speed
     reads as an animation; a hit that freezes reads as an impact.

     The freeze starts ~45ms in rather than immediately, so the recoil has
     visibly begun before it is caught — pausing on frame zero would just
     delay the animation. */
  const stopTimers = useRef<number[]>([]);
  const freeze = useCallback(() => {
    stopTimers.current.push(
      window.setTimeout(() => setHitStop(true), 45),
      window.setTimeout(() => setHitStop(false), 115),
    );
  }, []);
  useEffect(() => {
    const timers = stopTimers.current;
    return () => timers.forEach(window.clearTimeout);
  }, []);

  /* Hard questions first, then medium — the boss should feel like the exam
     for the region, not another warm-up. */
  const questions = useMemo(() => {
    if (!boss) return [];
    void attempt;
    const pool = QUESTIONS[sectionId] ?? [];
    const byRank = (q: Question) => (q.difficulty === 'hard' ? 0 : q.difficulty === 'medium' ? 1 : 2);
    return shuffle(pool)
      .sort((a, b) => byRank(a) - byRank(b))
      .slice(0, 20)
      .map(fromDrillQuestion);
  }, [boss, sectionId, attempt]);

  if (!boss || !meta || !region || !path) {
    return (
      <Page>
        <EmptyState
          title="No boss here"
          detail="That region does not have a guardian. Head back to the map."
          action={<Button variant="primary" onClick={() => navigate({ name: 'map' })}>Back to the map</Button>}
        />
      </Page>
    );
  }

  const clearedInRegion = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
  const unlocked = clearedInRegion >= path.nodes.length;
  const alreadyBeaten = progress.achievements.includes(`boss-${boss.id}`);

  /* ------------------------------------------------------------ locked */

  if (!unlocked) {
    return (
      <Page>
        <BackLink to={{ name: 'path', section: sectionId }} label={region.title} />
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto w-44 opacity-40 grayscale">
            <BossArt section={sectionId} state="idle" />
          </div>
          <h1 className="heading mt-6 text-[clamp(1.4rem,3vw,2rem)]" style={{ color: boss.color }}>
            {boss.name}
          </h1>
          <p className="mt-2 font-script text-[13px] uppercase tracking-[0.18em] text-ink-faint">
            {boss.title}
          </p>
          <p className="mx-auto mt-5 max-w-md font-read text-[15.5px] leading-relaxed text-parchment-dim">
            The guardian will not stir until every landmark in {region.title} is cleared. You have{' '}
            <b className="text-parchment">{clearedInRegion} of {path.nodes.length}</b>.
          </p>
          <Button
            variant="primary"
            className="mt-7"
            onClick={() => navigate({ name: 'path', section: sectionId })}
          >
            Back to the road ▸
          </Button>
        </div>
      </Page>
    );
  }

  const question = questions[index];

  /* ------------------------------------------------------------- intro */

  if (phase === 'intro') {
    return (
      <Page>
        <BackLink to={{ name: 'path', section: sectionId }} label={region.title} />
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto w-56 animate-bossEnter">
            <BossArt section={sectionId} state="idle" />
          </div>

          <p className="eyebrow mt-6">{boss.title}</p>
          <h1 className="heading mt-2 text-[clamp(1.7rem,4vw,2.6rem)]" style={{ color: boss.color }}>
            {boss.name}
          </h1>

          <blockquote className="mx-auto mt-6 max-w-lg font-read text-[clamp(1rem,2vw,1.18rem)] italic leading-relaxed text-parchment-dim">
            “{boss.taunt}”
          </blockquote>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <span className="chip">{boss.health} hits to fell it</span>
            <span className="chip">You can take {boss.playerHealth}</span>
            <span className="chip">Hardest questions first</span>
          </div>

          {alreadyBeaten && (
            <p className="mt-5 font-script text-[12px] uppercase tracking-[0.16em] text-woods">
              ✦ Already defeated — fight again for the practice
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="mt-8"
            onClick={() => {
              sfx.warn();
              setStartedAt(Date.now());
              setPhase('fight');
            }}
          >
            Draw your blade ▸
          </Button>
          <p className="mt-4 font-read text-[13.5px] text-ink-faint">
            Losing costs you nothing but the attempt.
          </p>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------ result */

  if (phase === 'won' || phase === 'lost') {
    const won = phase === 'won';
    return (
      <Page>
        <div className="mx-auto max-w-2xl text-center">
          <div className={cx('mx-auto w-56', won && 'opacity-45 grayscale')}>
            <BossArt section={sectionId} state={won ? 'defeated' : 'idle'} />
          </div>

          <h1
            className="heading mt-7 text-[clamp(1.7rem,4vw,2.6rem)]"
            style={{ color: won ? boss.color : '#dd8571' }}
          >
            {won ? `${boss.name} falls` : 'You retreat'}
          </h1>

          <blockquote className="mx-auto mt-5 max-w-lg font-read text-[clamp(1rem,2vw,1.15rem)] italic leading-relaxed text-parchment-dim">
            “{won ? boss.defeated : boss.victory}”
          </blockquote>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                setAttempt((a) => a + 1);
                setIndex(0);
                setBossHp(boss.health);
                setPlayerHp(boss.playerHealth);
                setChosen(null);
                setRevealed(false);
                setBossState('idle');
                setPhase('intro');
              }}
            >
              Fight again
            </Button>
            <Button variant="primary" onClick={() => navigate({ name: 'map' })}>
              Back to the map ▸
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------- fight */

  const strike = (key: string) => {
    if (revealed || !question) return;

    const correct = key === question.correctKey;
    setChosen(key);
    setRevealed(true);

    answerQuestion({
      qid: question.id,
      section: sectionId,
      topic: question.topic,
      correct,
      ms: Date.now() - startedAt,
      xp: XP.question(question.difficulty, correct, 0),
    });

    if (correct) {
      sfx.correct();
      setBossState('hurt');
      freeze();
      const nextHp = bossHp - 1;
      setBossHp(nextHp);
      if (nextHp <= 0) {
        window.setTimeout(() => {
          setBossState('defeated');
          sfx.fanfare();
          burstConfetti(140);
          if (!alreadyBeaten) {
            updateProgress((p) => ({
              ...p,
              achievements: [...p.achievements, `boss-${boss.id}`],
              xp: p.xp + 400,
            }));
          }
          setPhase('won');
        }, 700);
        return;
      }
    } else {
      sfx.wrong();
      setBossState('attacking');
      setHeroHurt(true);
      freeze();
      window.setTimeout(() => setHeroHurt(false), 500);
      const nextHp = playerHp - 1;
      setPlayerHp(nextHp);
      if (nextHp <= 0) {
        window.setTimeout(() => setPhase('lost'), 900);
        return;
      }
    }
    window.setTimeout(() => setBossState('idle'), 620);
  };

  const next = () => {
    sfx.tick();
    setChosen(null);
    setRevealed(false);
    setStartedAt(Date.now());
    setIndex((i) => (i + 1) % questions.length);
  };

  return (
    <Page wide className="pb-10">
      {/* -------------------------------------------------------- arena */}
      <div
        className={cx(
          'mb-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-6',
          hitStop && 'hitstop',
        )}
      >
        {/* you */}
        <div className="flex flex-col items-center">
          <Art
            name="hero-char"
            sizes="(min-width: 1024px) 140px, (min-width: 640px) 120px, 84px"
            className={cx(
              'w-[84px] select-none sm:w-[120px] lg:w-[140px]',
              heroHurt ? 'animate-heroHurt' : 'animate-bobHero',
            )}
            style={{ filter: 'drop-shadow(0 8px 12px rgba(0,0,0,.55))' }}
          />
          <HealthPips label="You" value={playerHp} max={boss.playerHealth} color="#5fa86b" />
        </div>

        <div className="pb-10 font-display text-[clamp(1rem,2.4vw,1.6rem)] font-semibold text-ink-faint">
          vs
        </div>

        {/* the boss */}
        <div className="flex flex-col items-center">
          <BossArt section={sectionId} state={bossState} className="w-[110px] sm:w-[150px] lg:w-[180px]" />
          <HealthPips label={boss.name} value={bossHp} max={boss.health} color={boss.color} />
        </div>
      </div>

      {/* ------------------------------------------------------ question */}
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
            {question?.topic}
          </span>
          <button
            type="button"
            onClick={() => navigate({ name: 'path', section: sectionId })}
            className="font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
          >
            Flee ▸
          </button>
        </div>

        {question && (
          <div className="sheet p-5 sm:p-7">
            {question.label && (
              <p className="mb-4 border-l-4 border-[#c9b06a] bg-[#faf3e0] px-4 py-3 font-read text-[1.02rem] leading-relaxed">
                <RichText as="span" format="html">{question.label}</RichText>
              </p>
            )}

            <div className="prose-quill mb-5">
              <RichText as="div" format={question.promptFormat}>{question.prompt}</RichText>
            </div>

            <div className="space-y-2.5">
              {question.choices.map((choice, i) => {
                const isCorrect = choice.key === question.correctKey;
                const isChosen = choice.key === chosen;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => strike(choice.key)}
                    disabled={revealed}
                    className={cx(
                      'choice',
                      revealed && isCorrect && 'choice-correct',
                      revealed && isChosen && !isCorrect && 'choice-wrong',
                      revealed && 'choice-locked cursor-default',
                    )}
                  >
                    <span className="choice-key">{'ABCD'[i] ?? choice.key}</span>
                    <RichText as="span" format={choice.format} className="min-w-0 flex-1">
                      {choice.text}
                    </RichText>
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="mt-6 animate-fadein border-t-2 border-parchment-edge pt-5">
                <div
                  className="mb-2 font-script text-[13px] uppercase tracking-[0.16em]"
                  style={{ color: chosen === question.correctKey ? '#2f6b3a' : '#9c3326' }}
                >
                  {chosen === question.correctKey ? '⚔ A clean hit' : '✖ It strikes back'}
                </div>
                <RichText as="div" format="markdown" className="font-read leading-relaxed">
                  {question.why[question.correctKey] ?? question.whyGeneral ?? ''}
                </RichText>
                <Button variant="primary" size="lg" className="mt-5 w-full" onClick={next} autoFocus>
                  Press the attack ▸
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function HealthPips({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="mt-3 w-full max-w-[220px] text-center">
      <div className="mb-1.5 truncate font-display text-[12.5px] font-semibold text-parchment">
        {label}
      </div>
      {/* A pip going out gets a spring kick rather than a linear fade, so a hit
          landing is legible in the health bar itself and not only in the
          character's recoil. */}
      <div className="flex justify-center gap-1">
        {Array.from({ length: max }, (_, i) => {
          const lit = i < value;
          return (
            <m.span
              key={i}
              className="h-2.5 flex-1 rounded-full"
              style={{ maxWidth: 26 }}
              animate={{
                background: lit ? color : '#3a2f21',
                boxShadow: lit ? `0 0 8px ${color}88` : '0 0 0 rgba(0,0,0,0)',
                opacity: lit ? 1 : 0.25,
                scaleY: lit ? 1 : 0.55,
              }}
              transition={SPRING_SNAP}
            />
          );
        })}
      </div>
    </div>
  );
}
