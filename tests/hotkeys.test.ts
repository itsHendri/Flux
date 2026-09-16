import { describe, it, expect } from 'vitest';
import { isTypingTarget } from '../src/ui/hotkeys.ts';

describe('isTypingTarget', () => {
  it('leaves keystrokes to whatever is focused and expects them', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    // A focused button already fires its own click on Space.
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('claims keystrokes aimed at the page itself', () => {
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });

  it('is case-insensitive about the tag name', () => {
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
  });
});
