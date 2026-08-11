/* These pin a coupling that is otherwise invisible.
 *
 * `mapEvents.ts` reads a question's origin out of its *id* — `comma_castle-q3`
 * is a zone quiz, `e001` is an English drill — specifically so the map does not
 * have to import 621 kB of question bank to draw a ring around a pin. That is a
 * real dependency on a format owned by two other files (`normalize.ts` builds
 * the zone-quiz ids, the content JSON carries the drill ids), and nothing about
 * changing either one would obviously break the map.
 *
 * It would just stop showing echoes. Silently, on a feature whose whole job is
 * to be a gentle reminder — nobody notices a nudge that never arrives. Hence
 * tests on the parsing, not just the counting.
 */

import { describe, expect, it } from 'vitest';
import { dayKey, emptyProgress } from '@/lib/progress';
import type { Progress, ReviewEntry } from '@/types';
import { courierFor, mapEchoes } from './mapEvents';

const HOUR = 3_600_000;

/** A progress with exactly these questions in the review ladder. */
function withReview(entries: Record<string, Partial<ReviewEntry>>): Progress {
  const review: Record<string, ReviewEntry> = {};
  for (const [qid, e] of Object.entries(entries)) {
    review[qid] = { due: Date.now() - HOUR, box: 1, ...e };
  }
  return { ...emptyProgress(), review };
}

describe('mapEchoes', () => {
  it('files a zone quiz under the landmark its id names', () => {
    const echoes = mapEchoes(
      withReview({ 'comma_castle-q0': {}, 'comma_castle-q3': {}, 'data_delta-q1': {} }),
    );

    expect(echoes.byZone).toEqual({ comma_castle: 2, data_delta: 1 });
    expect(echoes.total).toBe(3);
  });

  it('files a drill question under its section, not a landmark', () => {
    const echoes = mapEchoes(withReview({ e001: {}, e042: {}, m014: {}, r007: {}, s100: {} }));

    /* Drills belong to a topic, and a topic spans several zones. Pinning one to
       a landmark would put a marker on a spot the student never stood on. */
    expect(echoes.byZone).toEqual({});
    expect(echoes.bySection).toEqual({ english: 2, math: 1, reading: 1, science: 1 });
  });

  it('counts only what is actually due', () => {
    const echoes = mapEchoes(
      withReview({
        'comma_castle-q0': { due: Date.now() - HOUR },
        'comma_castle-q1': { due: Date.now() + 48 * HOUR },
      }),
    );

    // A landmark you will be called back to next week is not calling you now.
    expect(echoes.byZone).toEqual({ comma_castle: 1 });
  });

  it('is empty for a student with nothing due', () => {
    const echoes = mapEchoes(emptyProgress());

    expect(echoes.total).toBe(0);
    expect(echoes.byZone).toEqual({});
    expect(echoes.bySection).toEqual({});
  });

  it('survives a zone id that itself contains the separator', () => {
    /* `lastIndexOf`, not `indexOf`. A zone called `q_and_a-q2` splits at the
       wrong place under the naive read and files an echo against a landmark
       that does not exist — a marker that never renders and never errors. */
    const echoes = mapEchoes(withReview({ 'q_and_a-q2': {} }));

    expect(echoes.byZone).toEqual({ q_and_a: 1 });
  });

  it('ignores an id it cannot place rather than inventing a home for it', () => {
    const echoes = mapEchoes(withReview({ x999: {}, '': {}, 'zzz-nope': {} }));

    expect(echoes.byZone).toEqual({});
    expect(echoes.bySection).toEqual({});
    // Still counted in the total: it is due, it is just not on the map.
    expect(echoes.total).toBe(3);
  });
});

describe('courierFor', () => {
  const pool = ['comma_castle', 'data_delta', 'equation_station', 'vocab_vault'];

  it('stands at one of the reachable landmarks', () => {
    const courier = courierFor(emptyProgress(), pool);

    expect(courier).not.toBeNull();
    expect(pool).toContain(courier!.zoneId);
  });

  it('does not move between renders', () => {
    /* The map re-renders on every pan. A courier picked with Math.random would
       teleport across the world while you dragged, which reads as a bug rather
       than as a character. */
    const a = courierFor(emptyProgress(), pool);
    const b = courierFor(emptyProgress(), pool);

    expect(a!.zoneId).toBe(b!.zoneId);
  });

  it('does not depend on the order the caller built the list in', () => {
    const forward = courierFor(emptyProgress(), pool);
    const backward = courierFor(emptyProgress(), [...pool].reverse());

    expect(forward!.zoneId).toBe(backward!.zoneId);
  });

  it('has nowhere to stand when nothing is reachable', () => {
    // A courier waiting under the mist is an invitation to a place you can't go.
    expect(courierFor(emptyProgress(), [])).toBeNull();
  });

  it('knows when today is already done', () => {
    const fresh = courierFor(emptyProgress(), pool);
    expect(fresh!.done).toBe(false);

    const finished = courierFor({ ...emptyProgress(), dailyDoneOn: dayKey() }, pool);
    expect(finished!.done).toBe(true);

    // Yesterday's completion says nothing about today.
    const stale = courierFor({ ...emptyProgress(), dailyDoneOn: '1999-01-01' }, pool);
    expect(stale!.done).toBe(false);
  });
});
