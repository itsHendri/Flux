/**
 * On-screen error reporting. Sprint 0 principle: no failure is silent.
 * Every module reports here instead of only throwing or console.error-ing.
 */

type Level = 'error' | 'warn';

interface Entry {
  source: string;
  message: string;
  level: Level;
  count: number;
  el: HTMLElement;
}

const MAX_ENTRIES = 8;
const entries = new Map<string, Entry>();
let container: HTMLElement | null = null;

function host(): HTMLElement {
  if (!container) {
    container = document.getElementById('errors');
    if (!container) {
      container = document.createElement('div');
      container.id = 'errors';
      document.body.appendChild(container);
    }
  }
  return container;
}

function render(entry: Entry): void {
  const suffix = entry.count > 1 ? ` (x${entry.count})` : '';
  entry.el.className = `err${entry.level === 'warn' ? ' warn' : ''}`;
  entry.el.innerHTML = '';
  const src = document.createElement('span');
  src.className = 'err-src';
  src.textContent = `[${entry.source}]`;
  entry.el.appendChild(src);
  entry.el.appendChild(document.createTextNode(entry.message + suffix));
}

function push(source: string, message: string, level: Level): void {
  const key = `${source}::${message}`;
  const existing = entries.get(key);
  if (existing) {
    existing.count++;
    render(existing);
    host().appendChild(existing.el); // move to bottom (most recent)
    return;
  }
  const el = document.createElement('div');
  const entry: Entry = { source, message, level, count: 1, el };
  entries.set(key, entry);
  render(entry);
  host().appendChild(el);

  if (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = entries.get(oldestKey);
      oldest?.el.remove();
      entries.delete(oldestKey);
    }
  }
}

/** Report a hard failure. Always also logs to console for devtools. */
export function reportError(source: string, message: unknown): void {
  const text = message instanceof Error ? message.message : String(message);
  console.error(`[${source}]`, message);
  push(source, text, 'error');
}

/** Report a recoverable problem. */
export function reportWarning(source: string, message: string): void {
  console.warn(`[${source}]`, message);
  push(source, message, 'warn');
}

/** Clear all entries matching a source prefix (e.g. after a successful recompile). */
export function clearErrors(source: string): void {
  for (const [key, entry] of entries) {
    if (entry.source === source) {
      entry.el.remove();
      entries.delete(key);
    }
  }
}

/** Install global hooks so uncaught errors are never invisible. */
export function installGlobalErrorHooks(): void {
  window.addEventListener('error', (e) => {
    reportError('uncaught', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError('promise', e.reason);
  });
}
