import { reportWarning } from '../core/errors.ts';

/**
 * Audio source factory. The live microphone input terminates in this shape —
 * an `AudioSource` — so AudioEngine stays source-agnostic and only ever
 * connects `node` into its analyser.
 */
export interface AudioSource {
  /** Node to connect into the AnalyserNode. */
  node: AudioNode;
  /** If true, AudioEngine also routes the analyser to the speakers. */
  monitor: boolean;
  /** Human-readable label for the UI. */
  label: string;
  /** Stop tracks / oscillators, disconnect nodes, revoke object URLs. */
  dispose(): void;
}

/** Friendly explanation for the common getUserMedia failure modes. */
function micErrorHint(name: string): string {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission denied — allow microphone access for this site in the browser and macOS System Settings > Privacy > Microphone.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no matching microphone was found on this device.';
    case 'NotReadableError':
      return 'the microphone is busy in another application.';
    default:
      return 'could not open the microphone.';
  }
}

/** Live microphone (or any getUserMedia audio input). Not monitored — feedback. */
export async function createMicSource(
  ctx: AudioContext,
  deviceId?: string,
): Promise<AudioSource> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'this browser does not expose microphone access (navigator.mediaDevices.getUserMedia is unavailable).',
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : 'Error';
    throw new Error(`microphone unavailable (${name}): ${micErrorHint(name)}`);
  }

  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('input granted but the stream carried no audio track.');
  }

  const label = track.label || 'default input';
  // If the device vanishes mid-use (controller unplugged, BlackHole removed),
  // the track ends — surface that rather than letting visuals silently freeze.
  track.addEventListener('ended', () => {
    reportWarning('input', `"${label}" disconnected — pick another input.`);
  });

  const node = ctx.createMediaStreamSource(stream);
  return {
    node,
    monitor: false,
    label: `input: ${label}`,
    dispose() {
      node.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** A file source also hands back the element, so a transport can drive it. */
export interface FileAudioSource extends AudioSource {
  /** The element doing the playing — play/pause/seek go through this. */
  readonly media: HTMLAudioElement;
}

/** Why an `<audio>` element gave up on a file. */
function mediaErrorHint(err: MediaError | null): string {
  switch (err?.code) {
    case MediaError.MEDIA_ERR_DECODE:
      return 'the file is corrupt or uses an unsupported encoding.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'this browser cannot play that audio format.';
    case MediaError.MEDIA_ERR_ABORTED:
      return 'loading was aborted.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'the file could not be read.';
    default:
      return 'the file could not be decoded.';
  }
}

/**
 * Play a local audio file through the analyser.
 *
 * An `<audio>` element + `MediaElementAudioSourceNode` (rather than
 * `decodeAudioData` into a buffer) is what buys transport for free: seeking,
 * play/pause and duration are the element's job, and huge files stream instead
 * of being held in memory decoded.
 *
 * Two quirks the rest of the app depends on:
 * - An element can be captured by `createMediaElementSource` exactly **once**,
 *   and from then on its audio only reaches the speakers through the graph —
 *   hence `monitor: true`. Each call therefore builds a fresh element, and
 *   `dispose()` really does throw it away.
 * - Playback must start from a user gesture; the caller resumes the
 *   AudioContext and calls `media.play()`.
 */
export async function createFileSource(
  ctx: AudioContext,
  file: File,
): Promise<FileAudioSource> {
  const url = URL.createObjectURL(file);
  const media = new Audio();
  media.preload = 'auto';
  media.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      media.addEventListener('loadedmetadata', () => resolve(), { once: true });
      media.addEventListener(
        'error',
        () => reject(new Error(`"${file.name}" could not be loaded — ${mediaErrorHint(media.error)}`)),
        { once: true },
      );
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }

  // A decode failure mid-playback would otherwise just stop the visuals dead.
  media.addEventListener('error', () => {
    reportWarning('source:file', `playback of "${file.name}" failed — ${mediaErrorHint(media.error)}`);
  });

  const node = ctx.createMediaElementSource(media);
  return {
    node,
    media,
    // Unlike the mic, the file has to be audible: once the element is captured
    // the graph is its only route to the speakers.
    monitor: true,
    label: `file: ${file.name}`,
    dispose() {
      media.pause();
      node.disconnect();
      media.removeAttribute('src');
      media.load(); // drop the decoder's hold on the blob before revoking
      URL.revokeObjectURL(url);
    },
  };
}
