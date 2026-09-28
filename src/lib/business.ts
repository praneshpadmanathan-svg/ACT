/* Who runs ACT Command, in one place.
 *
 * The legal pages, the landing footer and the terms all read from here, so a
 * change of name or address is one edit. Contact addresses are not here: they
 * live in `contact.ts` and come from build-time env vars.
 *
 * Every field is optional, and a page shows only what has been filled in.
 * Nothing here is legally required for this site as it stands: CalOPPA asks
 * for a policy and a way to reach the operator (the contact email covers
 * that), and COPPA's operator-address requirement applies to services that
 * collect from under-13s, which this one refuses to do. A name and address
 * are still worth adding before anything is ever sold. A placeholder in
 * brackets on a live legal page names nobody, so an unset field renders as
 * nothing rather than as "[COMPANY NAME]".
 */

export const BUSINESS: {
  /** The legal name of whoever operates the site: a company, or a person's name. */
  name: string | null;
  /** A postal address for legal notices. A PO box or registered-agent address works. */
  address: string | null;
  /** Whose law governs the terms, e.g. "the State of Texas, United States". */
  jurisdiction: string | null;
} = {
  name: null,
  address: null,
  jurisdiction: null,
};

/** "run by Jane Doe, PO Box 1, Austin TX" or "run independently". */
export function operatorPhrase(verb: 'run' | 'operated'): string {
  const who = [BUSINESS.name, BUSINESS.address].filter(Boolean).join(', ');
  return who ? `${verb} by ${who}` : `${verb} independently`;
}

/** Name and address for a footer line, or null when neither is set. */
export const OPERATOR_LINE = [BUSINESS.name, BUSINESS.address].filter(Boolean).join(' · ') || null;
