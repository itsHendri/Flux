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
