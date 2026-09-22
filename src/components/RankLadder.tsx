/* The rank ladder: seven ranks as one climb you can read standing still.
 *
 * What was here before was a 4-column grid of seven identical cards, each a
 * badge beside a name and an XP figure, the earned ones at full opacity and
 * the rest at 55%. It listed the ranks. It did not show a climb: nothing in it
 * said where the player actually stood between two rungs, the only thing
 * distinguishing rank two from rank six was the picture, and a grid that wraps
 * 4-then-3 has no direction — the ladder read left-to-right, then jumped back
 * to the left and down, which is not what climbing looks like.
 *
 * The rail beneath the badges is the fix and it is the whole idea: one
 * continuous track from Inkling to Sagecrown, with the rungs spaced so that
 * every gap is wider than the one before it. The gap between Inkling and
 * Pagewalker is 900 XP and the gap between Doubtbane and Sagecrown is 7,500,
 * and the ladder has to show that, because it gets harder and a row of evenly
 * spaced badges is a lie about it that costs a student their sense of how far
 * they have come. `positionOf` below sets exactly how far that goes, and why
 * it is not simply proportional. The fill runs to the player's own XP and
 * stops there, so the track *is* the progress bar; there is no second bar
 * restating it underneath.
 *
 * Clicking a rung selects it. That is the other half of the brief: the ladder
 * was previously a wall of thresholds with no way to ask "what is that one,
 * and what would it take?" — so every rung now answers both, in the panel
 * below, for earned, current and locked alike.
 *
 * *Beneath* the badges is not where the rail was drawn. The track element was
 * emitted before the rungs, so it painted above them — a gold line hanging
 * over the row like a ceiling, with the badges dangling off it and the
 * selected rung's ring butting into it from below. The comment on
 * `.rank-ladder-rungs` had described the intended arrangement correctly the
 * whole time ("rungs sit above the rail, anchored by their bottom edge"); only
 * the source order disagreed with it. Rungs first, then the rail.
 *
 * Double-clicking opens the ladder full screen. At 4.5rem a rung is as wide as
 * it can be before the narrowest gap — 13% of the track — stops clearing the
 * widest rank name, which is what holds the inline ladder to a 42rem floor and
 * makes the badges small. The expanded view is not bound by the panel it sits
 * in, so it spends the space instead: wider rungs, larger sigils, and a track
 * deliberately wider than any screen, so the climb is something you travel
 * along rather than take in at a glance. It opens centred on the rung you are
 * standing on, which is what puts the ranks behind you off to the left.
 *
 * The aura is deliberately spent on exactly one badge. `RankAura` is a live
 * canvas per instance; seven of them is seven particle fields competing for
 * the same glance, which makes the current rank harder to find rather than
 * easier. One lit rung in a row of struck metal is legible at a distance, and
 * it is also seven times less work.
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { RANKS, XP, rankIndexFor, type Rank } from '@/lib/progress';
import { cx } from '@/lib/utils';
import { RankSigil } from './RankSigil';

/* A medium question is 16 XP before any streak bonus. Read from the real
   table rather than typed here, so a change to the XP economy cannot leave
   this quietly promising the wrong number of questions. */
const XP_PER_QUESTION = XP.question('medium', true, 0);

/* Where a rank sits along the track: part XP share, part index share.
 *
 * Pure XP spacing was the first attempt and it is the more honest of the two,
 * but it does not survive contact with this ladder's own numbers. Inkling,
 * Pagewalker and Quillbearer are 0, 900 and 2,400 against a 21,000 top, so all
 * three land inside the first 11% of the track and their labels sit on top of
 * one another — a scale nobody can read is not more honest than one they can,
 * it just fails silently.
 *
 * Pure index spacing is the other failure: seven evenly spaced rungs say the
 * climb is seven equal steps, and it is not. The last gap is eight times the
 * first.
 *
 * The blend keeps the part that matters. At 30/70 the gaps come out at 13.0,
 * 13.8, 15.1, 16.8, 19.0 and 22.4 percent — strictly increasing, so the ladder
 * still visibly widens as it goes and the shape of the climb survives, while
 * the narrowest gap stays wide enough for a rung to own its label.
 *
 * The weight is set by that last constraint and not by taste. The widest rank
 * name renders at 89px, so the narrowest gap has to clear 89px or two labels
 * collide; at 30/70 that puts the minimum usable track at 688px, which fits
 * the panel on a desktop without scrolling. An even split reads better as a
 * chart and needs an 850px track, which does not fit — so it scrolls on
 * every screen, and a ladder you have to drag to see the end of is worse than
 * one drawn slightly flatter.
 *
 * The fill is mapped through the same function, so the head of the bar always
 * sits where the player stands relative to the badges either side of it.
 */
const TOP_XP = RANKS[RANKS.length - 1]!.xp;

function positionOf(xp: number): number {
  const share = TOP_XP === 0 ? 0 : Math.min(1, Math.max(0, xp / TOP_XP));

  /* Which two rungs this XP falls between, so a position part-way up a rank
     interpolates across that rung's own slice of the track rather than being
     placed by the linear share alone. */
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1]!.xp) i++;
  const even = (v: number) => v / (RANKS.length - 1);

  const lo = RANKS[i]!;
  const hi = RANKS[i + 1] ?? null;
  const within = hi && hi.xp > lo.xp ? (xp - lo.xp) / (hi.xp - lo.xp) : 0;
  const evenShare = even(i + Math.min(1, Math.max(0, within)));

  return 0.3 * share + 0.7 * evenShare;
}

/* The badges and the rail they stand on, shared by the inline ladder and the
   expanded one so the two cannot drift apart. Everything that differs between
   them is a custom property set on the wrapper — see `.rank-ladder` in
   premium.css — except the sigil, which takes a number and so is passed one. */
function Rungs({
  xp,
  here,
  selected,
  onSelect,
  expanded = false,
}: {
  xp: number;
  here: number;
  selected: number;
  onSelect: (i: number) => void;
  expanded?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const fill = positionOf(xp) * 100;

  /* Opening the expanded view puts the selected rung in the middle of the
     screen rather than at the left edge. That is what leaves the ranks you
     have already earned off to the left to scroll back to — starting at
     scroll zero would hide the far end of the climb instead, which is the
     half nobody has seen yet.

     Deliberately keyed on `expanded` alone: re-running this on every
     selection would drag the ladder out from under a pointer that is simply
     moving along it, which turns clicking the next rung into a chase. */
  useEffect(() => {
    if (!expanded) return;
    const rung = scroller.current?.querySelectorAll<HTMLElement>('.rank-rung')[selected];
    rung?.scrollIntoView({ inline: 'center', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div className="rank-ladder-scroll" ref={scroller}>
      {/* One scroller wrapping both, so the track and the rungs stay on the
          same scale when a narrow screen — or the expanded view's deliberately
          oversized floor — makes the ladder wider than the viewport. Scrolling
          them separately would slide the badges off their own thresholds. */}
      <div>
        <ol className="rank-ladder-rungs" aria-label="The seven ranks">
          {RANKS.map((r, i) => {
            const earned = i <= here;
            const current = i === here;
            return (
              <li
                key={r.id}
                className="rank-rung"
                style={{ left: `${positionOf(r.xp) * 100}%` }}
                aria-current={current ? 'step' : undefined}
              >
                <button
                  type="button"
                  className={cx(
                    'rank-rung-button',
                    earned && 'is-earned',
                    current && 'is-current',
                    i === selected && 'is-selected',
                  )}
                  onClick={() => onSelect(i)}
                  aria-pressed={i === selected}
                  /* Metal, dimming and a glow are invisible to a screen reader,
                     and the earned state is the only thing the ladder is for. */
                  aria-label={`${r.name}, ${r.xp.toLocaleString()} XP${
                    current ? ', your rank' : earned ? ', earned' : ', locked'
                  }`}
                >
                  <RankSigil
                    rank={r}
                    size={expanded ? (current ? 84 : 64) : current ? 58 : 44}
                    aura={current}
                  />
                  <span
                    className="rank-rung-name"
                    style={{
                      color: earned
                        ? `color-mix(in oklab, ${r.color} var(--rank-tint), oklch(var(--c-parchment)))`
                        : undefined,
                    }}
                  >
                    {r.name}
                  </span>
                  <span className="num rank-rung-xp">{r.xp.toLocaleString()}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* The rail, after the rungs so it paints under them. See the note at
            the top of this file — for its first release it was emitted first
            and drew a line across the tops of the badges. */}
        <div className="rank-ladder-track" aria-hidden="true">
          <span className="rank-ladder-fill" style={{ width: `${fill}%` }} />
        </div>
      </div>
    </div>
  );
}

export function RankLadder({ xp }: { xp: number }) {
  const here = rankIndexFor(xp);
  /* Opens on the player's own rung — the one they came to look at. The
     selection is deliberately not "the next rank": someone at Quillbearer
     opening this wants to be told where they are before being told what they
     have not done yet. */
  const [selected, setSelected] = useState(here);
  const [expanded, setExpanded] = useState(false);
  const rank = RANKS[selected]!;

  return (
    <div className="rank-ladder">
      <div className="rank-ladder-head">
        <button
          type="button"
          className="rank-ladder-expand"
          onClick={() => setExpanded(true)}
          /* Double-click is the gesture that was asked for, and it is also one
             nobody discovers on their own. This says the full-screen view
             exists; the gesture is for the second visit onwards. */
        >
          Expand
        </button>
      </div>

      <div onDoubleClick={() => setExpanded(true)}>
        <Rungs xp={xp} here={here} selected={selected} onSelect={setSelected} />
      </div>

      <RankDetail rank={rank} index={selected} here={here} xp={xp} />

      {/* Base UI owns the focus trap, the scroll lock, Escape and outside-press
          — the same four things `CommandPalette` judged worth the dependency,
          and the same four that are fiddly enough to get subtly wrong by hand.
          It is already in the bundle this screen loads. */}
      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Backdrop className="rank-ladder-backdrop fixed inset-0 z-[110] bg-leather-950/80 backdrop-blur-[2px]" />
          <Dialog.Popup className="rank-ladder-full panel">
            <div className="rank-ladder-full-head">
              <Dialog.Title className="font-display text-title font-bold text-parchment">
                Your climb
              </Dialog.Title>
              <Dialog.Close className="rank-ladder-expand">Close</Dialog.Close>
            </div>

            {/* The ladder is shorter than a full-screen dialog, so it is
                centred in what is left below the title rather than left
                hanging from the top edge with half a screen of nothing under
                it. A wrapper rather than `margin-block: auto`, which centres
                just as well right up until the content is taller than the
                space and then puts the top of it out of scrolling reach. */}
            <div className="rank-ladder-full-body">
              <div className="rank-ladder is-expanded">
                <Rungs xp={xp} here={here} selected={selected} onSelect={setSelected} expanded />
                <RankDetail rank={rank} index={selected} here={here} xp={xp} />
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/* What the selected rung actually means, in the three states it can be in.
   Each answers a different question, so each gets different copy rather than
   one sentence with the numbers swapped: an earned rank is a receipt, the
   current one is a position, and a locked one is a plan. */
function RankDetail({
  rank,
  index,
  here,
  xp,
}: {
  rank: Rank;
  index: number;
  here: number;
  xp: number;
}) {
  const next = RANKS[index + 1] ?? null;
  const tint = `color-mix(in oklab, ${rank.color} var(--rank-tint), oklch(var(--c-parchment)))`;

  /* Progress *through* the selected rank, which is only a meaningful figure
     for the one the player is standing on. Above it there is no progress yet
     and below it the rank is finished. */
  const span = next ? next.xp - rank.xp : 0;
  const into = Math.min(span, Math.max(0, xp - rank.xp));
  const pct = span ? into / span : 1;

  const toGo = rank.xp - xp;
  const questions = Math.ceil(toGo / XP_PER_QUESTION);

  return (
    <div className="rank-detail panel-quiet" key={rank.id}>
      <div className="rank-detail-head">
        <h3 className="font-display text-title font-bold" style={{ color: tint }}>
          {rank.name}
        </h3>
        <span className="rank-detail-state">
          {index < here ? 'Earned' : index === here ? 'Your rank' : 'Locked'}
        </span>
      </div>

      <p className="mt-1 font-read text-[13.5px] leading-relaxed text-parchment-dim">
        {rank.tagline}
      </p>

      {index < here && (
        <p className="rank-detail-line">
          Earned at <b className="num text-parchment">{rank.xp.toLocaleString()}</b> XP. You are{' '}
          <b className="num text-parchment">{(xp - rank.xp).toLocaleString()}</b> XP past it.
        </p>
      )}

      {index === here && (
        <>
          <p className="rank-detail-line">
            {next ? (
              <>
                <b className="num text-parchment">{into.toLocaleString()}</b> of{' '}
                <b className="num text-parchment">{span.toLocaleString()}</b> XP through this rank —{' '}
                <b className="num text-parchment">{(next.xp - xp).toLocaleString()}</b> more to{' '}
                {next.name}, about{' '}
                <b className="num text-parchment">
                  {Math.ceil((next.xp - xp) / XP_PER_QUESTION).toLocaleString()}
                </b>{' '}
                questions.
              </>
            ) : (
              <>
                The top of the ladder, at{' '}
                <b className="num text-parchment">{xp.toLocaleString()}</b> XP. There is no rank
                eight — from here the only number that moves is the one on the test.
              </>
            )}
          </p>
          {next && (
            <div className="rank-detail-bar" aria-hidden="true">
              <i style={{ width: `${pct * 100}%`, background: tint }} />
            </div>
          )}
        </>
      )}

      {index > here && (
        <p className="rank-detail-line">
          Opens at <b className="num text-parchment">{rank.xp.toLocaleString()}</b> XP —{' '}
          <b className="num text-parchment">{toGo.toLocaleString()}</b> from here, about{' '}
          <b className="num text-parchment">{questions.toLocaleString()}</b> questions at a medium
          difficulty. Every one you get right counts, and the ones you get wrong still count for a
          little.
        </p>
      )}
    </div>
  );
}
