/* Read-aloud, on the browser's own synthesiser.
 *
 * A standard accommodation for the Reading section and for dyslexic students,
 * and it needs no dependency, no API key and no audio leaving the device —
 * `speechSynthesis` has been in every shipping browser for a decade and this
 * app had never touched it.
 *
 * The awkward parts of the API, all handled here so no component has to know:
 *
 *  - **It is a single global queue.** Two components each calling `speak()`
 *    produce two utterances back to back, not one interrupting the other. So
 *    there is exactly one speaker in the app and starting anything cancels
 *    whatever was already going.
 *
 *  - **`getVoices()` is empty on first call in Chrome.** The list arrives
 *    asynchronously via `voiceschanged`. Asking for a voice before then
 *    silently gets the system default in whatever language the OS is set to.
 *
 *  - **Long text stalls.** Chrome stops speaking after roughly fifteen
 *    seconds of continuous synthesis unless the utterance is short. A passage
 *    is far longer than that, so text is split on sentence boundaries and
 *    queued as separate utterances — which also makes stopping responsive.
 *
 *  - **Nothing reports "finished" reliably** if the tab is hidden mid-speech.
 *    Subscribers get a `speaking` flag rather than a completion promise, and
 *    the flag is also cleared by a `visibilitychange` guard.
 */

type Listener = (speaking: boolean) => void;

const listeners = new Set<Listener>();
let speaking = false;
/** Identifies the current run, so a stale `onend` cannot clear a newer one. */
let runId = 0;

export const speechSupported =
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

function setSpeaking(value: boolean): void {
  if (speaking === value) return;
  speaking = value;
  for (const listener of listeners) listener(value);
}

export function onSpeakingChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(speaking);
  return () => listeners.delete(listener);
}

export const isSpeaking = (): boolean => speaking;

/* Prime the voice list. Chrome populates it asynchronously and returns an
   empty array until it has; touching it once at module load means the list is
   usually ready by the time anybody presses play. */
if (speechSupported) {
  void window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    void window.speechSynthesis.getVoices();
  });
  /* A backgrounded tab can leave the queue paused with `speaking` still true,
     which would strand the button in its "stop" state forever. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && speaking) stopSpeaking();
  });
}

/** Prefer an English voice; fall back to whatever the system offers. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => v.lang.startsWith('en') && v.localService) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null
  );
}

/* Chunk on sentence ends, then hard-wrap anything still oversized.

   The 180-character ceiling is well under the point where Chrome's synthesis
   watchdog cuts in, and short utterances make `stop` feel instant: cancelling
   only has to abandon the current chunk, not a paragraph. */
const MAX_CHUNK = 180;

export function chunkForSpeech(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) ?? [clean];
  const out: string[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) out.push(trimmed);
    buffer = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK) {
      flush();
      // A sentence longer than the ceiling on its own — break it on spaces.
      for (const word of sentence.split(' ')) {
        if ((buffer + word).length > MAX_CHUNK) flush();
        buffer += `${word} `;
      }
      flush();
      continue;
    }
    if ((buffer + sentence).length > MAX_CHUNK) flush();
    buffer += sentence;
  }
  flush();
  return out;
}

/** Stop whatever is being read, immediately. Safe to call when idle. */
export function stopSpeaking(): void {
  if (!speechSupported) return;
  runId += 1;
  window.speechSynthesis.cancel();
  setSpeaking(false);
}

/**
 * Read `text` aloud, replacing anything already being read.
 *
 * `rate` sits slightly under 1 by default: the system default is tuned for
 * notifications, and a question stem read at that speed is faster than a
 * person reading it to themselves, which defeats the point.
 */
export function speak(text: string, { rate = 0.95 }: { rate?: number } = {}): void {
  if (!speechSupported) return;
  stopSpeaking();

  const chunks = chunkForSpeech(text);
  if (!chunks.length) return;

  const run = ++runId;
  const voice = pickVoice();
  setSpeaking(true);

  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = rate;
    utterance.lang = voice?.lang ?? 'en-US';
    if (voice) utterance.voice = voice;

    if (i === chunks.length - 1) {
      utterance.onend = () => {
        // A cancelled run's final utterance still fires `onend`.
        if (run === runId) setSpeaking(false);
      };
    }
    utterance.onerror = () => {
      if (run === runId) setSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  });
}

/** Start reading, or stop if this same text is already being read. */
export function toggleSpeech(text: string): void {
  if (speaking) {
    stopSpeaking();
    return;
  }
  speak(text);
}
