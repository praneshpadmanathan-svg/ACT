/* The landmark lessons and their quizzes — loaded on demand by `loadZoneBank()`.
 *
 * Keyed by zone id across all four roads, which is how both files are
 * authored. Nothing that runs before you open a landmark (or review a
 * landmark question) needs either. */

import type { Lesson, ZoneQuestion } from '@/types';

import lessonsJson from './lessons.json';
import miniquizzesJson from './miniquizzes.json';

// JSON widens the fixed-length rule tuples to string[], so these go through
// `unknown` rather than loosening the types the rest of the app relies on.
export const LESSONS = lessonsJson as unknown as Record<string, Lesson>;
export const ZONE_QUIZZES = miniquizzesJson as unknown as Record<string, ZoneQuestion[]>;
