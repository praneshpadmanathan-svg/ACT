/* The command palette's front door, with none of the palette behind it.
 *
 * This module exists so that asking for the palette costs nothing. The dialog
 * itself pulls in Base UI's dialog machinery — focus trap, scroll lock,
 * outside-press — which measured 17 kB gzipped on the eager path when the
 * palette was imported directly by `Shell`. Most sessions never press ⌘K, and
 * none of them should pay for it before the first paint.
 *
 * So: the shortcut listener and this event live eagerly; the dialog is code-
 * split and loads on the first open. A custom event rather than context, because
 * a trigger should not have to be a descendant of anything to say "open" — the
 * rail, the mobile bar and any empty state can all call this directly. */

const OPEN_EVENT = 'act-command:palette-open';

export function openPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function onPaletteOpen(fn: () => void): () => void {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}

/** ⌘ on a Mac, Ctrl everywhere else. A key cap showing the wrong key is worse
 *  than no key cap, so this is read off the platform rather than guessed. */
export function modKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl ';
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl ';
}

/* ------------------------------------------------------------------ matching

   Subsequence, not substring: "cmst" should find "Comma Castle", because the
   whole point of a palette is that you type four letters and stop thinking
   about it. Lives here rather than in the component so it can be tested
   without pulling a dialog and a content index in behind it. */

/**
 * Score `query` against `text`, or `null` if the letters are not all present
 * in order.
 *
 * Higher is better, and two things do the shaping. A hit at the start of a
 * word scores well above one buried mid-word, and a run of consecutive hits
 * compounds — which is what keeps a real prefix ahead of a scattered match
 * that happens to contain the same letters. Ties break toward the shorter
 * target, so "Commas" beats "Commas and clauses" for `commas` rather than the
 * answer depending on which was declared first.
 */
export function scoreMatch(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;

  let ti = 0;
  let total = 0;
  let run = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at === -1) return null;
    run = at === ti && ti > 0 ? run + 1 : 0;
    const wordStart = at === 0 || t[at - 1] === ' ' || t[at - 1] === '-';
    total += 1 + run * 4 + (wordStart ? 6 : 0);
    ti = at + 1;
  }
  return total - text.length * 0.05;
}
