import type { SelectOption } from '../core/state.ts';

/**
 * Named Gray-Scott regimes.
 *
 * Feed and kill are two numbers a hundredth apart, and the interesting parts of
 * that plane are small islands between "dies out" and "floods the frame". Nobody
 * finds them by nudging sliders mid-set. These are the islands, from Robert
 * Munafo's map of Pearson's classification (mrob.com/pub/comp/xmorphia); picking
 * one writes Feed and Kill, and the sliders stay for fine-tuning from there.
 */
export interface RdPattern {
  name: string;
  feed: number;
  kill: number;
}

export const RD_PATTERNS: RdPattern[] = [
  // The long branching labyrinth — the default, and the one that reads best
  // at high detail.
  { name: 'Maze', feed: 0.029, kill: 0.057 },
  { name: 'Coral', feed: 0.0545, kill: 0.062 },
  // Cells that grow, pinch and divide.
  { name: 'Mitosis', feed: 0.0367, kill: 0.0649 },
  // Isolated dots that hold their spacing.
  { name: 'Spots', feed: 0.035, kill: 0.065 },
  // Travelling, self-replicating squiggles.
  { name: 'Worms', feed: 0.058, kill: 0.065 },
];

export function patternOptions(): SelectOption[] {
  return RD_PATTERNS.map((p, i) => ({ label: p.name, value: i }));
}

/** Feed/kill uniforms for a pattern index; out-of-range falls back to the first. */
export function patternValues(index: number): { uRdFeed: number; uRdKill: number } {
  const p = RD_PATTERNS[Math.round(index)] ?? RD_PATTERNS[0];
  return { uRdFeed: p.feed, uRdKill: p.kill };
}
