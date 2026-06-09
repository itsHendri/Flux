# FLUX Roadmap

The single source of truth for what's built and what's next. The autonomous
loop (see `AGENT_LOOP.md`) reads this file, takes the **first unchecked task**,
completes it, ticks it, and rolls straight on to the next — building
continuously through Phase 1, with one atomic commit per task, then stopping at
the Phase 1 → backlog boundary for review.

Task format: `- [ ]` unchecked / `- [x]` done. Each task has a **Done:**
criterion — the machine-checkable condition that means it's finished.

---

## Done

- [x] **Sprint 0 — Foundation.** Vite + TS scaffold, AudioEngine with
  fast-attack/slow-release envelope follower, WebGL2 single-pass renderer, 3
  modes (bars/pulse/plasma), on-screen error overlay, always-on render loop.
- [x] **Sprint 1 — Input picker.** Mic device dropdown via `enumerateDevices`,
  permission-before-enumerate, alias dedup, live `devicechange` refresh.
  (Repositioned mic-only; test tone / file / loopback removed.)
- [x] **Phase 0 — Loop infrastructure.** Git, README, this roadmap,
  `AGENT_LOOP.md`, `CHANGELOG.md`, vitest harness for pure-logic modules.

---

## Phase 1 — Shader & sound-visualization core (current focus)

The aesthetics of how sound is visualized are the priority. Push this furthest.
Every task here is **research-first**: study trending and open-source/reference
shaders (Shadertoy, Inigo Quilez, awesome-audio-visualization, etc.), cite
sources in the commit + CHANGELOG, then implement.

- [x] **Multi-pass FBO pipeline.** Refactor `src/render/Renderer.ts` to render
  the active mode into an off-screen framebuffer/texture, then run an ordered,
  toggleable post-pass chain to the screen. Add a ping-pong FBO pair so passes
  can sample the previous frame (feedback). New seam: a `PostPass` interface and
  a pass registry on `Renderer`, mirroring the existing mode registry.
  *Done:* the 3 existing modes render identically through the new path with an
  empty/no-op pass chain; build + Preview screenshot clean; no console errors.

- [x] **Bayer ordered-dither pass.** Research Codrops / Maxime Heckel /
  glsl-dither. Add a toggleable dither post-pass; matrix size (2/4/8) as a
  control. *Done:* toggling it visibly dithers; off = unchanged; build clean.

- [x] **Palette quantization pass.** Quantize output to N colours; optional
  band-driven palette shift (e.g. bass rotates hue). Toggleable, N as a control.
  *Done:* quantization visible when on; build + Preview clean.

- [x] **Feedback / trails pass.** Use the ping-pong pair; decay amount as a
  control. *Done:* motion leaves decaying trails when on; build clean.

- [x] **Bloom pass.** Bright-pass + separable Gaussian blur, additive composite;
  intensity + threshold controls. *Done:* highlights bloom when on; build clean.

- [x] **Chromatic aberration pass.** Per-channel UV offset scaled by a control
  and/or audio. *Done:* visible RGB split when on; build clean.

- [x] **Kaleidoscope / mirror-symmetry pass.** Angular reflection with a
  segment-count control. *Done:* radial symmetry when on; build clean.

- [x] **Scanline / VHS pass.** Scanlines + slight noise/jitter; intensity
  control. *Done:* visible when on; build clean.

- [ ] **Control-type expansion.** Extend `ControlDef` (`src/core/state.ts`,
  `src/ui/controls.ts`) with `type: 'slider' | 'toggle' | 'select' | 'color'`;
  branch in `src/ui/ControlPanel.ts`. Pass toggles reuse this. *Done:* a toggle
  and a select render and drive their uniforms; existing sliders unchanged;
  build + tests clean.

- [ ] **New mode: raymarched SDF.** Research Inigo Quilez raymarching/SDF. New
  `src/shaders/modes/*.frag` + entry in `src/shaders/modes.ts`; audio-reactive.
  *Done:* mode appears in the switcher, renders, reacts; build clean.

- [ ] **New mode: domain-warp flow field.** Research iq domain warping. *Done:*
  as above.

- [ ] **New mode: a trending technique.** Research Shadertoy trending /
  awesome-audio-visualization; pick the best fit and adapt (cite source/licence).
  *Done:* as above.

- [ ] **Per-mode controls + live-steering polish.** Give each mode an expressive
  control set; ensure smooth live manipulation and sensible defaults. *Done:*
  each mode has ≥3 meaningful controls; build + Preview clean.

---

## Phase 2+ — Backlog (after Phase 1)

- [ ] **Beat / onset detection** via spectral flux (`src/audio/`). Expose event
  uniforms (e.g. `uBeat`, `uOnset`) so visuals trigger on hits, not just react
  continuously.
- [ ] **Presets.** Save/recall control + mode + pass state to localStorage
  (`src/presets/`). `ControlDef.id` already exists for stable keys.
- [ ] **Logo / image upload.** Rasterise an uploaded SVG/PNG → `texImage2D` →
  `uniform sampler2D uLogo`; modes that displace/mask/ripple it on audio.
- [ ] **Web MIDI.** Map a controller's (Traktor S2) knobs/faders to uniforms
  (`src/audio/midi.ts`).
- [ ] **Performance output.** Fullscreen, second-display, and Picture-in-Picture
  (`captureStream` → hidden `<video>` → `requestPictureInPicture`).
- [ ] **Deploy track (gated).** Produce a self-hostable static `dist/` and
  document hosting options. **Do not** push to any third-party host without
  explicit user approval (org tooling policy).

---

## Notes for the loop

- Build continuously through Phase 1, one atomic commit per task. **Stop at the
  end of Phase 1** (don't start the backlog) and flag for review.
- If a task needs a human product decision, **stop and record the question in
  `CHANGELOG.md`** rather than guessing.
- Keep tasks small enough to finish as one commit. If a task is too big, split
  it into 2–3 smaller `- [ ]` tasks and commit that planning change first.
