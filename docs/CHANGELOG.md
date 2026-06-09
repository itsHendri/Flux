# FLUX Changelog

Plain-English log of every completed task, newest first. Each loop iteration
adds one entry (see `AGENT_LOOP.md`).

---

## Phase 1 — Kaleidoscope / mirror-symmetry pass

- **`src/shaders/passes/kaleido.frag`** — converts each pixel to polar coords
  around centre, folds the angle into `uKaleidoSegments` equal wedges with a
  mirror inside each (for seamless seams), and samples the source at the folded
  position. Classic kaleidoscope rosette; segment count is live-controllable.
- New schema control: **Kaleido Segments**.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows clear 6-fold
radial mirror symmetry when toggled on, error overlay empty, no console errors.

---

## Phase 1 — Chromatic aberration pass

- **`src/shaders/passes/chroma.frag`** — samples R and B along the radial
  direction from screen centre with opposite offsets (G fixed), so colour
  fringing grows toward the edges. Magnitude is `uChromaAmount` scaled by the
  audio level, so the split pulses with the sound. Toggleable.
- New schema control: **Chroma Split**.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows clear RGB
fringing — unmistakable at band boundaries with quantize also on — error
overlay empty, no console errors.

---

## Phase 1 — Bloom pass (+ multi-stage pass support)

A proper separable-Gaussian bloom, which needed a small pipeline extension first.

- **Multi-stage passes.** `PostPass` now accepts `stages: string[]` (multiple
  fragments run back-to-back under one toggle) alongside the single-`fragSource`
  form. Added a `uScene` sampler bound to **the pass's own input** (snapshotted
  into a dedicated `passInput` FBO for multi-stage passes), so a final stage can
  composite onto what entered the pass — not just the previous stage. Existing
  single-stage passes are unchanged.
- **`bloom-h.frag` / `bloom-v.frag`** — stage 1 does a bright-pass (luma soft
  knee at `uBloomThreshold`) + horizontal 9-tap Gaussian; stage 2 does the
  vertical 9-tap and adds the blurred highlights onto `uScene` scaled by
  `uBloomIntensity`. Standard GPU-Gems separable kernel weights.
- New schema controls: **Bloom Threshold** and **Bloom Intensity**.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows highlights
gaining a soft feathered glow when toggled on (dramatic at intensity 2.6), the
existing passes still render correctly through the refactored chain, error
overlay empty, no console errors.

---

## Phase 1 — Feedback / trails pass

The first pass to exploit the pipeline's history FBO (`uPrevFrame`).

- **`src/shaders/passes/trails.frag`** — max-blends the current scene with the
  previous frame's output decayed by `uTrailDecay`, so motion smears into
  glowing trails that accumulate frame over frame. Registered **first** in the
  chain so feedback operates on raw motion before stylisation.
- New schema control: **Trail Decay** (0..1) — higher = longer-lived trails.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows plasma motion
building into smeared glowing trails (clearly stronger at decay 0.99), error
overlay empty, no console errors.

---

## Phase 1 — Palette quantization pass

A toggleable pass that reduces the scene to N flat colours.

- **`src/shaders/passes/quantize.frag`** — maps scene luminance onto a cosine
  palette sampled at `uPaletteColors` quantised steps, so the output collapses
  to a small banded palette. **Bass rotates the palette phase**, plus a manual
  `uPaletteShift` offset, so the colour scheme shifts on the beat.
- New schema controls: **Palette Colors** (N) and **Palette Shift**.

Source: Inigo Quilez's cosine-palette technique
(https://iquilezles.org/articles/palettes/). Verified: `npm run build` clean,
12/12 tests pass, Preview shows the plasma collapse to ~6 flat banded colours
when toggled on, error overlay empty, no console errors.

---

## Phase 1 — Bayer ordered-dither pass

First post-effect on the new pipeline: a toggleable ordered-dither pass that
gives the classic cross-hatched retro look.

- **`src/shaders/passes/dither.frag`** — samples the scene (`uSource`) and
  quantises each channel to `uDitherLevels` steps, dithering between adjacent
  levels with a Bayer ordered threshold matrix. Matrix size snaps to 2 / 4 / 8
  via `uDitherSize` (finer pattern at 8). Canonical 2×2 / 4×4 / 8×8 Bayer
  matrices.
- **`src/shaders/passes.ts`** — the pass registry, mirroring `modes.ts`
  (`PASSES` + HMR), so adding a `.frag` + an entry is all it takes.
- **Effects panel + toggle** — `main.ts` registers every pass and renders an
  "Effects" section of toggle buttons wired to `renderer.setPassEnabled`. This
  is the lightweight pass-toggle seam until typed toggle controls land.
- Two new schema controls: **Dither Matrix** and **Dither Levels**.

Sources: hughsk/glsl-dither (MIT), Maxime Heckel's ordered-dithering writeup,
and the Codrops dithering guide. Verified: `npm run build` clean, 12/12 tests
pass, Preview shows the cross-hatch dither appear when toggled on and the
gradients return smooth when off, error overlay empty, no console errors.

---

## Phase 1 — Multi-pass FBO pipeline

Refactored the `Renderer` from a single direct-to-screen draw into a multi-pass
pipeline, the foundation for every post-effect that follows (dither, bloom,
feedback, etc.):

- **New `Framebuffer` helper** (`src/render/Framebuffer.ts`) — allocates RGBA8
  off-screen render targets (LINEAR/CLAMP, no depth), with resize + delete.
- **Mode → off-screen `scene` FBO.** The active mode no longer draws straight to
  the screen; it renders into a texture.
- **Ordered, toggleable post-pass chain** across a **ping-pong** pair
  (`ping`/`pong`), so each pass samples the previous stage as `uSource`. The
  final texture is blitted to the screen (`gl.blitFramebuffer`). With an empty
  chain the mode's texture is presented unchanged — the 3 existing modes look
  identical to before.
- **Feedback support.** A `history` FBO keeps last frame's final output, bound
  as `uPrevFrame`, so trail/feedback passes can sample the previous frame.
- **New `PostPass` seam + pass registry** on `Renderer` (`registerPass`,
  `setPassEnabled`, `passNames`), mirroring the existing mode registry. Passes
  share the mode header (builtins + control uniforms + `common.glsl`) plus the
  two sampler uniforms.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows plasma
rendering identically through the new path, error overlay empty
(`#errors.childElementCount === 0`), WebGL context alive, no console errors.

This is plumbing, not an aesthetic change, so no reference shader was adapted;
the ping-pong + blit-to-screen pattern is the standard WebGL2 post-processing
approach.

---

## Loop protocol — continuous multi-task build

Adjusted the autonomous loop from one-task-per-iteration to **continuous
building**: each run works through tasks back-to-back, with one atomic commit
per task, and stops at the **end of Phase 1** for review (or when blocked /
context grows heavy). Per-task commits + per-task verification are preserved, so
a long unattended run stays fully reviewable and reversible. Designed to run on
an interval `/loop` so context auto-resets between runs.

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
