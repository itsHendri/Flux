/**
 * Keyboard shortcuts for live steering.
 *
 * Performing means both hands on the instrument, so the things you reach for
 * mid-set get a key. One listener on the window owns them all: a binding is a
 * key code, a description (so a help overlay can print the set later) and what
 * to do.
 */
export interface Binding {
  /** `KeyboardEvent.code`, e.g. `Space`, `Digit1`, `KeyF`. */
  code: string;
  description: string;
  run(): void;
}

/** The bits of an event target that decide whether a keystroke is ours. */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

const WIDGET_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'OPTION']);

/**
 * True if the keystroke belongs to whatever is focused rather than to us:
 * text fields need their spaces and digits, and a focused button already
 * fires its own click on Space.
 */
export function isTypingTarget(target: KeyTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  const tag = target.tagName?.toUpperCase();
  return tag !== undefined && (WIDGET_TAGS.has(tag) || tag === 'BUTTON');
}

export class Hotkeys {
  private readonly bindings = new Map<string, Binding>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.handle(e));
  }

  /** Register a key. A second binding of the same code replaces the first. */
  bind(code: string, description: string, run: () => void): void {
    this.bindings.set(code, { code, description, run });
  }

  /** Every binding, in registration order — for a help list. */
  get list(): Binding[] {
    return [...this.bindings.values()];
  }

  private handle(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const binding = this.bindings.get(e.code);
    if (!binding) return;
    if (isTypingTarget(e.target as KeyTarget | null)) return;
    e.preventDefault();
    binding.run();
  }
}
