import { describe, it, expect } from 'vitest';
import { stepIndex } from '../src/ui/PerformanceBar.ts';

describe('stepIndex — the mode cycler', () => {
  it('steps forward and back', () => {
    expect(stepIndex(0, 1, 8)).toBe(1);
    expect(stepIndex(3, -1, 8)).toBe(2);
  });

  it('wraps in both directions', () => {
    expect(stepIndex(7, 1, 8)).toBe(0);
    // JS % keeps the sign of the left operand: -1 % 8 is -1, not 7.
    expect(stepIndex(0, -1, 8)).toBe(7);
    expect(stepIndex(0, -9, 8)).toBe(7);
  });

  it('treats an unknown current mode as the start of the list', () => {
    expect(stepIndex(-1, 1, 8)).toBe(1);
  });

  it('survives an empty list rather than returning NaN', () => {
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});
