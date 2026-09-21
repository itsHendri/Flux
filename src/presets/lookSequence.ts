/**
 * Which look comes next when a set changes on its own.
 *
 * In order: the next in the list, wrapping. Shuffled: every look once before
 * any repeats (a bag, refilled when empty), and never the one showing now —
 * a random pick with replacement would repeat itself and leave some looks
 * unseen for a whole set.
 */
export class LookSequence {
  private bag: string[] = [];

  constructor(private readonly names: string[]) {}

  next(current: string | null, order: 'sequence' | 'shuffle', rng: () => number = Math.random): string {
    if (this.names.length === 0) return current ?? '';
    if (this.names.length === 1) return this.names[0];
    if (order === 'sequence') {
      const i = current ? this.names.indexOf(current) : -1;
      return this.names[(i + 1) % this.names.length];
    }
    this.bag = this.bag.filter((n) => n !== current);
    if (this.bag.length === 0) this.bag = this.names.filter((n) => n !== current);
    const i = Math.floor(rng() * this.bag.length);
    const [pick] = this.bag.splice(i, 1);
    return pick;
  }
}
