/* Who runs ACT Command, in one place.
 *
 * The legal pages, the landing footer and the terms all read from here, so a
 * change of name or address is one edit. Every value in square brackets is a
 * placeholder the operator has not supplied yet. `BUSINESS_IS_PLACEHOLDER`
 * lets a deploy check refuse to ship them.
 *
 * Contact addresses are not here: they live in `contact.ts` and come from
 * build-time env vars.
 */

export const BUSINESS = {
  /** The legal name of whoever operates the site: a company, or a person's name. */
  name: '[COMPANY NAME]',
  /** A postal address for legal notices. A PO box or registered-agent address works. */
  address: '[MAILING ADDRESS]',
  /** Whose law governs the terms, e.g. "the State of Texas, United States". */
  jurisdiction: '[GOVERNING JURISDICTION]',
} as const;

export const BUSINESS_IS_PLACEHOLDER = Object.values(BUSINESS).some((v) => v.startsWith('['));
