/**
 * Pure helpers for the file-playback source. No DOM, no Web Audio — just the
 * two decisions the transport has to get right: which dropped file to take,
 * and how to print a time.
 */

/** The parts of a `File` that matter here (so this stays testable). */
export interface FileLike {
  name: string;
  type: string;
}

/**
 * Extensions we accept when a drop carries no MIME type. Browsers usually
 * fill `type`, but files from archives/network shares often arrive as an
 * empty string, and refusing a `.wav` because of that would be absurd.
 */
const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.aiff', '.aif',
];

/**
 * True if this looks like something an `<audio>` element could play. The MIME
 * type decides whenever there is one — so an image or a video is refused even
 * if its extension is ambiguous — and the extension only gets a say when the
 * browser handed us nothing. Dual-purpose containers (`.mp4`, `.webm`) are
 * deliberately absent from the fallback list: without a type we can't tell a
 * track from a film, and guessing wrong is worse than saying no.
 */
export function isAudioFile(file: FileLike): boolean {
  if (file.type.startsWith('audio/')) return true;
  if (file.type !== '') return false;
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** First playable file in a drop (or file input), or null if there is none. */
export function pickAudioFile<T extends FileLike>(files: readonly T[]): T | null {
  return files.find(isAudioFile) ?? null;
}

/**
 * Clock readout for the scrubber: `m:ss`, or `h:mm:ss` past an hour.
 * Unknown durations (a stream, or metadata not loaded yet) read `0:00`
 * rather than `NaN:aN`.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
