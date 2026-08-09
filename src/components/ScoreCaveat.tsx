/* The line that says a score here is not a score.
 *
 * `scaleScore` in `progress.ts` carries an honest comment — the percent-to-36
 * curve is "not an official concordance" — and that honesty lived entirely in
 * the source. On screen a student saw an eighty-pixel gold number with the
 * word "Composite" under it and nothing else, which is a prediction whether or
 * not it was meant as one.
 *
 * One component rather than a sentence typed at each site, because the phrase
 * that matters is the same phrase everywhere and it must not drift into
 * something softer at one of them. What differs is only how far from a real
 * score the number is, which is what `kind` selects.
 */

import { hrefFor } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';

export type ScoreKind = 'test' | 'estimate';

const LINE: Record<ScoreKind, string> = {
  /* Sat under timed conditions, so the number came from something real — but
     from a shorter section than the real one, on a curve ACT has never seen. */
  test: 'A practice score on our own scale — close to ACT’s published tables, but not an official concordance, and these sections are shorter than the real ones.',
  /* Not a test at all: drill accuracy, untimed, on questions you may have
     seen before and can retry. Further from test day than the above. */
  estimate:
    'Worked out from your practice accuracy, not a scored test — untimed, on questions you can retry. Treat it as a rough band.',
};

export function ScoreCaveat({ kind, className }: { kind: ScoreKind; className?: string }) {
  return (
    <p className={cx('font-read text-[11.5px] leading-relaxed text-ink-faint', className)}>
      {LINE[kind]}{' '}
      <a
        href={hrefFor({ name: 'faq' })}
        onClick={() => sfx.select()}
        className="underline underline-offset-2 transition-colors hover:text-parchment-dim"
      >
        How accurate is it?
      </a>
    </p>
  );
}
