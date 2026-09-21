/**
 * How the mode picker groups the modes, and — flattened — the order the
 * cycler walks them. One table, so the picker's reading order and the ‹ ›
 * order can never disagree.
 *
 * Grouped by what a mode *is* rather than how it's built: a spectrogram and a
 * waveform both read the signal directly, even though one is a fragment
 * shader and the other a custom-draw mode with a ring buffer.
 */
export interface ModeGroup {
  label: string;
  modes: string[];
}

export const MODE_GROUPS: ModeGroup[] = [
  { label: 'signal', modes: ['bars', 'waveform', 'spectro', 'scope'] },
  { label: 'fields', modes: ['flow', 'cells', 'mandala', 'sand', 'fur', 'logo'] },
  { label: 'simulations', modes: ['reaction', 'fluid'] },
  { label: 'raymarched', modes: ['raymarch', 'chrome', 'bulb', 'lattice'] },
  { label: 'particles', modes: ['magneto', 'trails3d', 'forge', 'synapse'] },
];

/**
 * Arrange the registered modes into the table's groups. Modes the table lists
 * but that didn't register (a custom mode can refuse, e.g. without float
 * render targets) are dropped, and empty groups with them; registered modes
 * the table doesn't know land in a trailing `other` group rather than
 * vanishing from the picker.
 */
export function groupModes(registered: string[], groups: ModeGroup[] = MODE_GROUPS): ModeGroup[] {
  const present = new Set(registered);
  const placed = new Set<string>();
  const out: ModeGroup[] = [];
  for (const g of groups) {
    const modes = g.modes.filter((m) => present.has(m) && !placed.has(m));
    modes.forEach((m) => placed.add(m));
    if (modes.length > 0) out.push({ label: g.label, modes });
  }
  const rest = registered.filter((m) => !placed.has(m));
  if (rest.length > 0) out.push({ label: 'other', modes: rest });
  return out;
}

/** The cycler order: the groups read top to bottom, left to right. */
export function modeOrder(groups: ModeGroup[]): string[] {
  return groups.flatMap((g) => g.modes);
}
