/* The cold-start screen — the one screen every single visitor sees.
 *
 * It has been four things. First the word "Loading…" on a dark field. Then a
 * drawn compass with "Finding your place" under it, which was better and still
 * had the problem that sank it: a caption explaining a loading screen is a
 * caption nobody wants to read twice, and this one greeted you before you had
 * done anything at all.
 *
 * Then one painted object and no words — better again, and still wrong for a
 * reason no object could fix. A small flat cutout centred on an empty dark
 * field is a sticker on nothing, and the screen it hands over to is a
 * full-bleed painted sunset, so the first two seconds of the app were in a
 * different register from the third.
 *
 * So the field is a painting now, under the same scrim the landing screen puts
 * over its hero. Four backdrops and nine objects, both picked once per page
 * load. Variety is doing real work here rather than decorating: this is the
 * most-seen and least-looked-at screen in the app, and the failure state for
 * something seen daily and studied never is that it stops registering at all.
 * Thirty-six combinations is enough that it stays slightly new for months.
 *
 * Three layers, and each earns its place:
 *
 *   A CSS gradient, sampled from the backdrop it sits under, painting instantly
 *   at zero bytes. This screen exists precisely because things have not arrived
 *   yet — the frame where the painting has not decoded must not be a bare black
 *   rectangle, and that frame is the whole point of the screen.
 *
 *   The backdrop, at 12–25 KB on a phone. It is `art-heavy`, so reduced-data
 *   mode drops it and the gradient underneath carries the screen alone, which
 *   is exactly the graceful thing to happen.
 *
 *   The same `from-leather-950/72 … to-leather-950` scrim the landing screen
 *   uses, so the handover is a continuation rather than a cut.
 *
 * The copy is gone from the screen, not from the accessibility tree.
 * `role="status"` with nothing in it announces nothing, so a screen-reader user
 * would have been handed silence — precisely the failure the caption was added
 * to fix. It moves to `sr-only` instead.
 */

import { Art, type ArtName } from '@/components/Art';
import scenes from '@/sceneArt.json';

/* Gradients sampled off the paintings themselves — seven stops each, averaged
   across the middle half of every row, which is the part `object-cover` is
   most likely to keep. Hand-picking these would drift from the art the moment
   a backdrop was regenerated; these were measured. */
const BACKDROPS: { name: ArtName; sky: string }[] = [
  {
    name: 'scene-ridge',
    sky: '#252f52 0%, #905973 18%, #faa259 36%, #623c4c 50%, #453133 64%, #2d231b 80%, #36211a 100%',
  },
  {
    name: 'scene-river',
    sky: '#232e51 0%, #89536e 18%, #fba457 36%, #5e3a50 50%, #83593b 64%, #a76344 80%, #3e251e 100%',
  },
  {
    name: 'scene-pass',
    sky: '#4f6471 0%, #979082 18%, #c2a282 36%, #b19074 50%, #765a4b 64%, #573f33 80%, #573e31 100%',
  },
  {
    name: 'scene-harbour',
    sky: '#2b5f68 0%, #83867a 18%, #d98c64 36%, #6a4b3d 50%, #b37352 64%, #834731 80%, #6a3e2c 100%',
  },
];

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;

/* Chosen at module scope, so it is fixed for the life of the page. Picking
   inside the component would re-roll on every render — a backdrop that flicks
   between four paintings while you wait is worse than any one of them. */
const BACKDROP = pick(BACKDROPS);
const OBJECT = pick(scenes.objects);

export function LoadingScreen() {
  return (
    <div
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden"
      role="status"
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${BACKDROP.sky})` }}
      />
      <Art
        name={BACKDROP.name}
        priority
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-leather-950/72 via-leather-950/45 to-leather-950" />

      {/* Square, because every sprite is padded to one — so the reserved box is
          identical whichever of the nine comes up, and a wide rolled map simply
          sits shorter inside it instead of rendering half again as large as the
          hourglass. */}
      <img
        src={OBJECT.src}
        width={scenes.box}
        height={scenes.box}
        alt=""
        decoding="async"
        draggable={false}
        className="animate-float relative z-10 w-[min(52vw,224px)] select-none"
        style={{ filter: 'drop-shadow(0 10px 22px rgba(0,0,0,.7))' }}
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
