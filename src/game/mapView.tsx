/* Which slice of the map is actually on screen.
 *
 * The scenery does not know where the camera is. Every effect in `MapFx` and
 * every bank of the Grey in `DiscoveryLayer` mounts once and animates forever,
 * across the whole 768x1376 world, whether or not you can see it. Measured on
 * the live map at 1280x720 with three landmarks cleared:
 *
 *   333 elements running a CSS animation, 262 of them off screen (79%)
 *   total animating area .......... 11.7x the viewport
 *   of which blurred .............. 9.1x the viewport
 *
 * Nine viewports of blurred pixels is the whole problem. A blurred layer
 * cannot be handed to the compositor and forgotten; it re-rasterises as it
 * moves, so the browser was repainting several screens' worth of fog that
 * nobody was looking at, every frame, before it got to the one screen that
 * mattered. That is why the map feels slow to answer a drag and why the
 * animation stutters: not one bad effect, but everything running at once.
 *
 * The map is portrait and the regions are stacked, so a vertical band is all
 * the precision this needs — at default zoom roughly one region fills the
 * frame, and culling by band drops about three quarters of the work.
 *
 * The span is quantised before it goes into context. Panning fires pointermove
 * at screen rate, and a context value that changed on every one of those would
 * re-render the entire scenery tree mid-drag — trading a rasterise cost for a
 * React cost and making the stutter worse. Rounding to whole map-percent means
 * the tree re-renders only when the camera has genuinely moved somewhere new.
 */

import { createContext, memo, useContext, type ReactNode } from 'react';
import { MAP_H } from './mapData';

export interface MapSpan {
  /** Map-percent at the top edge of the frame, less the margin. */
  top: number;
  /** Map-percent at the bottom edge, plus the margin. */
  bottom: number;
}

/** Everything visible. The default matters: any consumer rendered outside a
 *  provider — a test, a screen that reuses one of these layers — must get the
 *  old behaviour rather than a blank map. */
const WHOLE_MAP: MapSpan = { top: -Infinity, bottom: Infinity };

export const MapSpanContext = createContext<MapSpan>(WHOLE_MAP);

/* Half a screen of runway on each side. Scenery is ambient: it should already
 * be playing when it arrives rather than starting as you look at it. A full
 * screen was the first guess and it barely culled anything — the visible span
 * came to three frames tall, which at default zoom is most of a four-band map,
 * so three of the four banks stayed mounted. Half a screen still means nothing
 * pops in at the edge at any reachable pan speed, and it is the difference
 * between culling one band and culling three. */
const MARGIN_SCREENS = 0.5;

/** The visible span of the map, in map-percent, from the camera. */
export function spanFromView(frameH: number, offsetY: number, scale: number): MapSpan {
  if (!frameH || !scale) return WHOLE_MAP;

  // Screen y of map-percent p, inverted. See the world layer's transform.
  const percentAt = (screenY: number) =>
    (((screenY - frameH / 2 - offsetY) / scale + MAP_H / 2) / MAP_H) * 100;

  const top = percentAt(0);
  const bottom = percentAt(frameH);
  const margin = (bottom - top) * MARGIN_SCREENS;

  // Whole percent, so a drag re-renders the tree at most once per percent.
  return { top: Math.floor(top - margin), bottom: Math.ceil(bottom + margin) };
}

/** Does a band of the map, given in map-percent, overlap what is on screen? */
export function useBandInView(top: number, height: number): boolean {
  const span = useContext(MapSpanContext);
  return top + height > span.top && top < span.bottom;
}

/** Mounts its children only while their band of the map is near the frame.
 *
 *  Unmounting rather than pausing: a paused animation keeps its layer and its
 *  blur, which is the cost being avoided. Scenery is decorative and stateless,
 *  so there is nothing to lose by rebuilding it, and it comes back a full
 *  screen before it can be seen. */
export const Band = memo(function Band({
  top,
  height,
  children,
}: {
  top: number;
  height: number;
  children: ReactNode;
}) {
  return useBandInView(top, height) ? <>{children}</> : null;
});
