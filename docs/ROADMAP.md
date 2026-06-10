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

- [x] **Control-type expansion.** Extend `ControlDef` (`src/core/state.ts`,
  `src/ui/controls.ts`) with `type: 'slider' | 'toggle' | 'select' | 'color'`;
  branch in `src/ui/ControlPanel.ts`. Pass toggles reuse this. *Done:* a toggle
  and a select render and drive their uniforms; existing sliders unchanged;
  build + tests clean.

- [x] **New mode: raymarched SDF.** Research Inigo Quilez raymarching/SDF. New
  `src/shaders/modes/*.frag` + entry in `src/shaders/modes.ts`; audio-reactive.
  *Done:* mode appears in the switcher, renders, reacts; build clean.

- [x] **New mode: domain-warp flow field.** Research iq domain warping. *Done:*
  as above.

- [x] **New mode: a trending technique.** Research Shadertoy trending /
  awesome-audio-visualization; pick the best fit and adapt (cite source/licence).
  *Done:* as above.

- [x] **Per-mode controls + live-steering polish.** Give each mode an expressive
  control set; ensure smooth live manipulation and sensible defaults. *Done:*
  each mode has ≥3 meaningful controls; build + Preview clean.

---

## Phase 2+ — Backlog (after Phase 1)

Refined and prioritized at the Phase 1 review (see
[`PHASE-1-REVIEW.md`](PHASE-1-REVIEW.md)). Grouped into a recommended order;
later groups can be reordered freely. Each task keeps a **Done:** criterion.

### 2a — Rendering quality (validated upgrades)

- [x] **HDR float-FBO pipeline.** Switch the off-screen targets in
  `src/render/Framebuffer.ts` from `RGBA8` to `RGBA16F`, gated on
  `EXT_color_buffer_float` (fallback `EXT_color_buffer_half_float`) +
  `OES_texture_half_float_linear`, with a clean RGBA8 fallback if unsupported.
  Unclamps bloom/trails accumulation. *Done:* trails/bloom visibly accumulate
  past 1.0 on supported hardware; RGBA8 path still works; build + Preview clean.
- [x] **Mip-chain / energy-conserving bloom.** Replace the fixed-res separable
  Gaussian with a downsample→upsample pyramid (Jimenez 2014) for a
  resolution-independent wide glow; drop the hard threshold for an
  energy-conserving bright-pass. Depends on the HDR FBOs. *Done:* glow is wide
  and stable across output sizes; intensity control still works; build clean.
- [x] **Dither quality options.** Add interleaved gradient noise (IGN,
  procedural) and/or a blue-noise texture as alternatives to Bayer in
  `dither.frag`, selectable via a control; keep Bayer (best temporal stability).
  *Done:* the dither pattern visibly changes between options; build clean.

### 2b — Audio

- [x] **Beat / onset detection** via spectral flux (`src/audio/`). Store the
  previous spectrum, sum half-rectified bin diffs in `AudioEngine.tick()`,
  adaptive-threshold to a beat/onset signal, reusing the existing analyser.
  Add `beat`/`onset` to `AudioFrame` (`src/core/state.ts`) and `uBeat`/`uOnset`
  to `BUILTIN_UNIFORMS` (`src/render/Renderer.ts`). *Done:* a uniform fires on
  hits (not just continuous reaction); a mode/pass triggers on it; build clean.

### 2c — State / UX

- [x] **Unify pass toggles into the control system.** Replace the ad-hoc Effects
  buttons in `src/main.ts` with the typed-control/state path so pass-enable state
  is part of the serializable schema (prerequisite for clean presets; resolves
  the parallel-toggle tech debt). *Done:* effects toggle through the unified
  state; behaviour unchanged; build + tests clean.
- [x] **Presets.** Save/recall control + mode + pass state to localStorage
  (`src/presets/`). `ControlDef.id` already gives stable keys; do this after the
  toggle unification so pass state serializes too. *Done:* a preset round-trips
  mode + controls + enabled passes; build clean.

### 2d — Input

- [x] **Logo / image upload.** Rasterise an uploaded SVG/PNG → `texImage2D` →
  `uniform sampler2D uLogo`; modes that displace/mask/ripple it on audio.
  *Done:* an uploaded image renders and reacts in at least one mode; build clean.
- [x] **Web MIDI — engine + learn UI.** `src/audio/midi.ts`: Web MIDI access,
  CC parsing (pure + tested), a MIDI-learn flow (pick control → twist knob →
  bound), bindings persisted to localStorage, MIDI section in the panel.
  *Done:* a simulated CC message drives a control (slider moves, uniform
  updates); graceful no-support/no-device paths; build + tests clean.
- [ ] **Web MIDI — hardware verification (needs the user's Traktor S2).**
  Plug in the controller, learn a knob, confirm it drives a control live and
  the binding survives a reload. *Done:* verified by the user on hardware;
  any fixes committed.

### 2e — Output

- [ ] **Performance output.** Fullscreen, second-display, and Picture-in-Picture
  (`captureStream` → hidden `<video>` → `requestPictureInPicture`). *Done:* the
  visual shows fullscreen and in a PiP window; build clean.
- [ ] **Deploy track (gated).** Produce a self-hostable static `dist/` and
  document hosting options. **Do not** push to any third-party host without
  explicit user approval (org tooling policy). *Done:* `dist/` serves standalone;
  hosting options documented; no third-party push without approval.

### Known tech debt / limitations (from the Phase 1 audit)

- **Parallel toggle mechanisms** — pass on/off (ad-hoc buttons,
  `src/main.ts:108`) vs. the typed `'toggle'` control; pass state isn't
  serializable. Resolved by task **2c**.
- **RGBA8 FBOs** (`src/render/Framebuffer.ts:24`) clamp bloom/trails at 1.0.
  Resolved by task **2a**.
- **Bloom radius is resolution-dependent** (fixed-res Gaussian). Resolved by **2a**.
- **Bayer dither** shows structured lines in static frames. Mitigated by **2a**
  dither options.
- **Minor:** stale "file, test tone" monitoring comment at
  `src/audio/AudioEngine.ts:63` (sources are mic-only now).
- **Perf:** no low-end fallback — a per-mode quality/step control (e.g. raymarch
  step count) would help weak GPUs.

---

## Notes for the loop

- Build continuously through Phase 1, one atomic commit per task. **Stop at the
  end of Phase 1** (don't start the backlog) and flag for review.
- If a task needs a human product decision, **stop and record the question in
  `CHANGELOG.md`** rather than guessing.
- Keep tasks small enough to finish as one commit. If a task is too big, split
  it into 2–3 smaller `- [ ]` tasks and commit that planning change first.
