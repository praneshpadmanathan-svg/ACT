/* Pixel sprite icons, drawn from a character grid.

   Each icon is a small array of strings; a letter maps to a palette colour,
   "." is transparent. Rendering as one <div> per lit pixel would be heavy, so
   the whole sprite is a single element built from box-shadow offsets — the
   same trick the original used, but typed and memoised. */

import { useMemo } from 'react';
import { cx } from '@/lib/utils';

interface Sprite {
  rows: string[];
  pal: Record<string, string>;
}

const K = '#0d0620';

export const ICONS: Record<string, Sprite> = {
  book: {
    pal: { k: K, w: '#f4f0ff', b: '#3ad6f0', d: '#1f8fb0' },
    rows: [
      '.kkkkkkkk.',
      'kbbbbbbbbk',
      'kbwwwwwwbk',
      'kbwkwwkwbk',
      'kbwwwwwwbk',
      'kbwkwwkwbk',
      'kbwwwwwwbk',
      'kddddddddk',
      '.kkkkkkkk.',
      '..........',
    ],
  },
  sword: {
    pal: { k: K, s: '#d8dff5', h: '#ffd23e', g: '#8a5a2a' },
    rows: [
      '.......kk.',
      '......ksk.',
      '.....kssk.',
      '....kssk..',
      '...kssk...',
      '..kssk....',
      '.khhhhk...',
      'kghgk.....',
      'kgk.......',
      'kk........',
    ],
  },
  trophy: {
    pal: { k: K, g: '#ffd23e', d: '#c99a12', s: '#a89ac6' },
    rows: [
      'kkkkkkkkkk',
      'kggggggggk',
      'kkggggggkk',
      '.kgggggggk',
      '..kgggggk.',
      '...kdddk..',
      '....kdk...',
      '...kdddk..',
      '..ksssssk.',
      '..kkkkkkk.',
    ],
  },
  flame: {
    pal: { k: K, r: '#ff5d3b', o: '#ffb347', y: '#ffd23e' },
    rows: [
      '....kk....',
      '...krrk...',
      '..krrrrk..',
      '..krrorrk.',
      '.krroooork',
      '.kroyyyork',
      'kroyyyyokr',
      'kroyyyyokr',
      '.kroooork.',
      '..kkkkkk..',
    ],
  },
  map: {
    pal: { k: K, p: '#e8d8a0', g: '#5ee6a8', r: '#ff5d78' },
    rows: [
      'kkkkkkkkkk',
      'kppppppppk',
      'kpggpppppk',
      'kppgppgppk',
      'kpppgpgppk',
      'kppppgpppk',
      'kpppprpppk',
      'kppppppppk',
      'kppppppppk',
      'kkkkkkkkkk',
    ],
  },
  star: {
    pal: { k: K, y: '#ffd23e', o: '#ff9d5c' },
    rows: [
      '....kk....',
      '....yy....',
      '...kyyk...',
      'kkkkyykkkk',
      'kyyyyyyyyk',
      '.kyyyyyyk.',
      '..kyyyyk..',
      '.kyyokyyk.',
      'kyyk..kyyk',
      'kk......kk',
    ],
  },
  bolt: {
    pal: { k: K, y: '#ffd23e', o: '#ff9d5c' },
    rows: [
      '.....kkk..',
      '....kyyk..',
      '...kyyk...',
      '..kyyk....',
      '.kyyyyyk..',
      'kkkkyyok..',
      '...kyok...',
      '..kyok....',
      '..kok.....',
      '..kk......',
    ],
  },
  clock: {
    pal: { k: K, w: '#e8ecff', c: '#3ad6f0', d: '#1f8fb0' },
    rows: [
      '..kkkkkk..',
      '.kcccccck.',
      'kcwwwwwwck',
      'kcwwkwwwck',
      'kcwwkwwwck',
      'kcwwkkkwck',
      'kcwwwwwwck',
      'kcwwwwwwck',
      '.kcccccck.',
      '..kkkkkk..',
    ],
  },
  chart: {
    pal: { k: K, v: '#b79cff', g: '#5ee6a8', y: '#ffd23e' },
    rows: [
      'k........k',
      'k........k',
      'k......yyk',
      'k....yyyyk',
      'k..gggyyyk',
      'k..gggyyyk',
      'kvvgggyyyk',
      'kvvgggyyyk',
      'kvvgggyyyk',
      'kkkkkkkkkk',
    ],
  },
  refresh: {
    pal: { k: K, c: '#3ad6f0', w: '#e8ecff' },
    rows: [
      '...kkkk...',
      '..kcccck..',
      '.kck..kck.',
      'kck....kck',
      'kck.......',
      'kck....kkk',
      'kck....kck',
      '.kck..kck.',
      '..kcccck..',
      '...kkkk...',
    ],
  },
  tools: {
    pal: { k: K, s: '#d8dff5', o: '#ff9d5c', g: '#8a5a2a' },
    rows: [
      'kk......kk',
      'ksk....ksk',
      'kssk..kssk',
      '.kssksskk.',
      '..kssssk..',
      '...kook...',
      '...kook...',
      '..kgoogk..',
      '..kgggk...',
      '..kkkk....',
    ],
  },
  calendar: {
    pal: { k: K, w: '#f4f0ff', r: '#ff5d78', d: '#a89ac6' },
    rows: [
      '.k.kk.k...',
      'kkkkkkkkkk',
      'krrrrrrrrk',
      'kwwwwwwwwk',
      'kwdwdwdwwk',
      'kwwwwwwwwk',
      'kwdwdwdwwk',
      'kwwwwwwwwk',
      'kwdwwwwwwk',
      'kkkkkkkkkk',
    ],
  },
  compass: {
    pal: { k: K, c: '#3ad6f0', r: '#ff5d78', w: '#e8ecff' },
    rows: [
      '..kkkkkk..',
      '.kwwwwwwk.',
      'kwwwwrwwwk',
      'kwwwwrwwwk',
      'kwwwrrrwwk',
      'kwwcccwwwk',
      'kwwcwwwwwk',
      'kwwwwwwwwk',
      '.kwwwwwwk.',
      '..kkkkkk..',
    ],
  },
  target: {
    pal: { k: K, r: '#ff5d78', w: '#f4f0ff', d: '#a83048' },
    rows: [
      '..kkkkkk..',
      '.kwwwwwwk.',
      'kwwrrrrwwk',
      'kwrrwwrrwk',
      'kwrwkkwrwk',
      'kwrwkkwrwk',
      'kwrrwwrrwk',
      'kwwrrrrwwk',
      '.kwwwwwwk.',
      '..kkkkkk..',
    ],
  },
  shield: {
    pal: { k: K, b: '#7c8cff', w: '#e8ecff', d: '#3a4ab0' },
    rows: [
      '.kkkkkkkk.',
      'kbbbbbbbbk',
      'kbwwwwwwbk',
      'kbwbbbbwbk',
      'kbwbwwbwbk',
      'kbwbbbbwbk',
      'kdbwwwwbdk',
      '.kdbwwbdk.',
      '..kdbbdk..',
      '...kkkk...',
    ],
  },
};

export type IconName = keyof typeof ICONS;

function shadowFor(sprite: Sprite, unit: number): string {
  const parts: string[] = [];
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = sprite.pal[ch];
      if (ch !== '.' && color) parts.push(`${x * unit}px ${y * unit}px 0 0 ${color}`);
    });
  });
  return parts.join(',');
}

interface Props {
  name: IconName | string;
  /** Pixel size of one sprite pixel. */
  unit?: number;
  className?: string;
  animate?: boolean;
}

export function PixelIcon({ name, unit = 3, className, animate }: Props) {
  const sprite = ICONS[name] ?? ICONS.star;
  const shadow = useMemo(() => shadowFor(sprite, unit), [sprite, unit]);
  const width = sprite.rows[0].length * unit;
  const height = sprite.rows.length * unit;

  return (
    <div
      className={cx('relative flex-none pixelated', animate && 'animate-bob', className)}
      style={{ width, height }}
      aria-hidden="true"
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: unit, height: unit, boxShadow: shadow }} />
    </div>
  );
}
