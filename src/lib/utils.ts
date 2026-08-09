/* Small shared helpers. */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Seeded PRNG (Lehmer). Used so generated scenery is stable between renders
 *  — the old build re-randomised the map every paint, which made it flicker. */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Fisher-Yates, optionally seeded for reproducible drill sets. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sample<T>(items: T[], n: number, rng: () => number = Math.random): T[] {
  return shuffle(items, rng).slice(0, n);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Title-case a topic slug like "verb tense" for display. */
export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/* One spelling per topic.

   The two question banks were authored at different times and name the same
   things differently. Drills use tidy lowercase — `commas`, `subject-verb
   agreement`. Zone quizzes carry a `tag` that is sometimes a proper topic
   (`Commas`, or `Subject–verb agreement` with an en-dash) and sometimes the
   zone's old shouting name (`COMMA CASTLE`), left over from before the
   landmarks were renamed after the terrain they stand on.

   Untreated, a student's weak-topic list splits commas across four rows —
   `commas`, `Commas`, `COMMA CASTLE`, and the raw `comma_castle` id when a
   question carries no tag at all. That fragments the single number they are
   relying on to decide what to study next. Canonicalising here gives both
   banks one shared vocabulary. */
export function canonicalTopic(raw: string): string {
  return (
    raw
      .trim()
      // en and em dashes are meant as hyphens here; underscores as spaces
      .replace(/[–—]/g, '-')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
  );
}

/** True for a zone's own label rather than a topic — `COMMA CASTLE` and the
 *  twenty-one others the zone quizzes were tagged with. */
export function isZoneLabel(raw: string): boolean {
  const t = raw.trim();
  return t.length > 0 && t === t.toUpperCase() && /[A-Z]/.test(t);
}
