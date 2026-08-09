/* Unpack a WOFF1 file back into the plain sfnt (.ttf/.otf) inside it.
 *
 * Why this exists: the OG share image is composed by `scripts/build-og.mjs`,
 * which rasterises an SVG through sharp → librsvg → fontconfig. Fontconfig
 * indexes sfnt files and ignores `.woff`, and `@fontsource` ships nothing but
 * `.woff`/`.woff2` — so the share card came out either blank or in whatever
 * serif Windows happened to have, and the one image that represents the
 * product on every link a student sends was the one image not set in the
 * product's own typeface.
 *
 * WOFF1 is not a font format so much as a wrapper: an sfnt whose tables have
 * each been zlib-deflated independently, with a rewritten directory. Undoing
 * it is inflate-per-table plus rebuilding the 12-byte header and the 16-byte
 * directory entries. No dependency, no network, deterministic output.
 *
 * WOFF2 is a different problem entirely (Brotli, plus a transformed `glyf`
 * table that has to be reconstructed) and is deliberately not handled — the
 * `.woff` sitting next to it in every @fontsource package is enough.
 *
 * Spec: https://www.w3.org/TR/WOFF/ §3–4.
 */

import { inflateSync } from 'node:zlib';

const WOFF_HEADER = 44;
const WOFF_ENTRY = 20;
const SFNT_ENTRY = 16;

/** @param {Buffer} woff  @returns {Buffer} the sfnt it contains */
export function woffToSfnt(woff) {
  if (woff.length < WOFF_HEADER || woff.toString('latin1', 0, 4) !== 'wOFF') {
    throw new Error('not a WOFF1 file (bad signature)');
  }

  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  /* The sfnt header's binary-search fields. Every consumer recomputes these,
     but a font with wrong ones is the kind of thing that works in one
     rasteriser and not the next, so they get written correctly. */
  let maxPow2 = 1;
  while (maxPow2 * 2 <= numTables) maxPow2 *= 2;
  const searchRange = maxPow2 * 16;
  const entrySelector = Math.log2(maxPow2);
  const rangeShift = numTables * 16 - searchRange;

  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const at = WOFF_HEADER + i * WOFF_ENTRY;
    dir.push({
      tag: woff.toString('latin1', at, at + 4),
      offset: woff.readUInt32BE(at + 4),
      compLength: woff.readUInt32BE(at + 8),
      origLength: woff.readUInt32BE(at + 12),
      checksum: woff.readUInt32BE(at + 16),
    });
  }

  /* Tables must come out in tag order in the directory. WOFF does not promise
     that order, and a font whose directory is unsorted is malformed. */
  dir.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  const bodies = dir.map((t) => {
    const raw = woff.subarray(t.offset, t.offset + t.compLength);
    /* compLength === origLength means the table was stored, not deflated —
       WOFF allows that whenever compression would have made it bigger. */
    const data = t.compLength === t.origLength ? Buffer.from(raw) : inflateSync(raw);
    if (data.length !== t.origLength) {
      throw new Error(`table ${t.tag}: inflated to ${data.length}, expected ${t.origLength}`);
    }
    return data;
  });

  const header = Buffer.alloc(12 + numTables * SFNT_ENTRY);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(rangeShift, 10);

  /* Each table starts on a 4-byte boundary; the padding is not counted in the
     directory's length field. */
  let cursor = header.length;
  const chunks = [header];
  dir.forEach((t, i) => {
    const at = 12 + i * SFNT_ENTRY;
    header.write(t.tag, at, 4, 'latin1');
    header.writeUInt32BE(t.checksum, at + 4);
    header.writeUInt32BE(cursor, at + 8);
    header.writeUInt32BE(t.origLength, at + 12);

    chunks.push(bodies[i]);
    cursor += bodies[i].length;
    const pad = (4 - (bodies[i].length % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      cursor += pad;
    }
  });

  return Buffer.concat(chunks);
}
