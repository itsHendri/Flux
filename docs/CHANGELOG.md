# FLUX Changelog

Plain-English log of every completed task, newest first. Each loop iteration
adds one entry (see `AGENT_LOOP.md`).

---

## Phase 0 — Loop infrastructure

Set up everything an autonomous loop needs to keep building FLUX safely:

- **Git** initialized; baseline commit captures Sprints 0–1 (foundation +
  mic-only input picker). `.gitignore` excludes `node_modules/` and `dist/`.
- **`README.md`** — what FLUX is, how to run it, the module map, conventions.
- **`docs/ROADMAP.md`** — the machine-readable task list and source of truth.
  Front-loads the shader & sound-visualization work; backlog holds beat
  detection, presets, logo upload, MIDI, performance output, and a gated deploy
  track.
- **`docs/AGENT_LOOP.md`** — the per-iteration protocol: pick the first unchecked
  task, research first, implement, verify (build + tests + Preview screenshot +
  no console errors), commit, log, tick. One task per iteration; never push;
  never commit a red build.
- **`docs/CHANGELOG.md`** — this file.
- **vitest** harness with unit tests for the pure-logic audio modules
  (`bands.ts`, `EnvelopeFollower.ts`); `npm test` added.

---

## History to date (pre-loop)

- **Sprint 1 — Input picker.** Mic device dropdown via `enumerateDevices`,
  permission-before-enumerate, dedup of `default`/`communications` aliases,
  live `devicechange` refresh. Briefly trialled BlackHole system-loopback, then
  removed it: it needs a per-machine virtual audio device (can't be click-and-go
  for a hosted product) and interfered with other audio apps. FLUX is now
  **mic-only**. Test tone and file upload were also removed to keep the input
  model to live sound only.
- **Sprint 0 — Foundation.** Vite + TS scaffold; AudioEngine with an asymmetric
  fast-attack/slow-release envelope follower for musical motion; WebGL2
  single-pass renderer with a fullscreen triangle; 3 shader modes
  (bars/pulse/plasma); schema-driven control panel; live meters; on-screen error
  overlay; always-on render loop (no play/pause); dockable transparent panel.
