/**
 * Microphone enumeration for the input picker.
 *
 * FLUX reacts to live microphone input. This lists whatever audio input
 * devices the machine exposes (built-in mic, USB mic, etc.) as the choices in
 * the dropdown.
 *
 * Key browser quirk: enumerateDevices() returns devices with EMPTY labels
 * until microphone permission has been granted at least once. So permission
 * must be requested before the list is useful — hence requestAudioPermission().
 */
export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

/**
 * Request microphone permission once, purely to unlock device labels. The
 * granted stream is immediately stopped — actual capture happens later via the
 * chosen device. Must be called from a user gesture.
 */
export async function requestAudioPermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('this browser does not expose audio device access.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  stream.getTracks().forEach((t) => t.stop());
}

/**
 * List the real audio input devices. Labels are only populated once mic
 * permission has been granted.
 *
 * Browsers expose synthetic "default" / "communications" aliases that point at
 * whatever the OS default device is — these duplicate a real device under a
 * different deviceId, so we drop them (and dedupe by label) to keep the list
 * to one entry per physical device.
 */
export async function listAudioInputs(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('this browser does not expose device enumeration.');
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((d) => d.kind === 'audioinput');

  const seen = new Set<string>();
  const result: AudioInputDevice[] = [];
  for (const d of inputs) {
    if (d.deviceId === 'default' || d.deviceId === 'communications') continue;
    const label = d.label || `Audio input ${result.length + 1}`;
    if (seen.has(label)) continue;
    seen.add(label);
    result.push({ deviceId: d.deviceId, label });
  }

  // Fallback: if a browser only exposes alias devices, keep them but strip the
  // "Default - " / "Communications - " prefix and dedupe by the bare label.
  if (result.length === 0) {
    for (const d of inputs) {
      const label = (d.label || 'Audio input').replace(
        /^(Default|Communications)\s*-\s*/i,
        '',
      );
      if (seen.has(label)) continue;
      seen.add(label);
      result.push({ deviceId: d.deviceId, label });
    }
  }
  return result;
}

/**
 * Subscribe to hardware changes (a microphone connected or removed). Returns
 * an unsubscribe function.
 */
export function onDeviceChange(cb: () => void): () => void {
  const md = navigator.mediaDevices;
  if (!md) return () => {};
  md.addEventListener('devicechange', cb);
  return () => md.removeEventListener('devicechange', cb);
}
