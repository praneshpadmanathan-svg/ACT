/* Map iconography, drawn to match the illustration's ink-and-wash style
   rather than borrowed from an emoji font.

   The lock is a wax seal bound by an iron hasp: the seal reads as "sealed
   until earned" rather than "error", which is the right feeling for a zone
   you simply have not reached yet. Emoji were also inconsistent across
   platforms and rendered flat against the painted background. */

interface SigilProps {
  size?: number;
  className?: string;
}

/** Locked zone — a wax seal with an iron hasp across it. */
export function LockSigil({ size = 18, className }: SigilProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* wax seal */}
      <path
        d="M12 3.4c1.9 0 2.3 1.5 3.9 2.1 1.6.6 2.9-.3 3.6 1.3.7 1.6-.6 2.5-.6 4.2s1.3 2.6.6 4.2c-.7 1.6-2 .7-3.6 1.3-1.6.6-2 2.1-3.9 2.1s-2.3-1.5-3.9-2.1c-1.6-.6-2.9.3-3.6-1.3-.7-1.6.6-2.5.6-4.2s-1.3-2.6-.6-4.2c.7-1.6 2-.7 3.6-1.3C9.7 4.9 10.1 3.4 12 3.4Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M12 3.4c1.9 0 2.3 1.5 3.9 2.1 1.6.6 2.9-.3 3.6 1.3.7 1.6-.6 2.5-.6 4.2s1.3 2.6.6 4.2c-.7 1.6-2 .7-3.6 1.3-1.6.6-2 2.1-3.9 2.1s-2.3-1.5-3.9-2.1c-1.6-.6-2.9.3-3.6-1.3-.7-1.6.6-2.5.6-4.2s-1.3-2.6-.6-4.2c.7-1.6 2-.7 3.6-1.3C9.7 4.9 10.1 3.4 12 3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.9"
      />
      {/* hasp */}
      <path
        d="M9.4 11.2V9.6a2.6 2.6 0 0 1 5.2 0v1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="8.1" y="11.1" width="7.8" height="5.5" rx="1.2" fill="currentColor" />
      <circle cx="12" cy="13.4" r="0.85" fill="rgba(0,0,0,.45)" />
      <rect x="11.6" y="13.8" width="0.8" height="1.9" rx="0.4" fill="rgba(0,0,0,.45)" />
    </svg>
  );
}

/** Cleared zone — a laurel tick stamped into the seal. */
export function ClearedSigil({ size = 18, className }: SigilProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 12.6 10 17l8.4-9.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mastered zone — a struck star, used when a zone is cleared at 100%. */
export function MasterSigil({ size = 18, className }: SigilProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 3.2 14.6 9l6.4.5-4.9 4.2 1.5 6.2L12 16.6 6.4 19.9l1.5-6.2L3 9.5 9.4 9Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The summit — a crown above the citadel. */
export function CrownSigil({ size = 20, className }: SigilProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.6 8.4 7 12l2.9-5.6L12 3.2l2.1 3.2L17 12l3.4-3.6 -1.5 10.2H5.1Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <rect x="5.1" y="19.2" width="13.8" height="1.9" rx="0.7" fill="currentColor" />
    </svg>
  );
}
