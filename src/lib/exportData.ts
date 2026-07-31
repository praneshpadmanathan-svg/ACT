/* "Download everything you have on me."

   Deliberately the plain, complete object rather than a curated report. The
   point of an export is that it is the actual record, so someone can check what
   is held rather than take our word for it — and so that deleting the account
   is a decision they can make without losing anything they wanted to keep. */

import type { Progress } from '@/types';

export interface ExportBundle {
  exportedAt: string;
  app: string;
  /** Present only for an account; guests have no identity to export. */
  account?: { name: string; email?: string };
  progress: Progress;
}

export function buildExport(
  progress: Progress,
  account?: { name: string; email?: string },
): ExportBundle {
  return {
    exportedAt: new Date().toISOString(),
    app: 'ACT Command',
    ...(account ? { account } : {}),
    progress,
  };
}

export function downloadProgress(
  progress: Progress,
  account?: { name: string; email?: string },
): void {
  const blob = new Blob([JSON.stringify(buildExport(progress, account), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `act-command-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari; a tick is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
