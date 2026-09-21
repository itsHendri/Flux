# FLUX Roadmap

The single source of truth for what's built and what's next. The autonomous
loop (see `AGENT_LOOP.md`) reads this file, takes the **first unchecked task in
the lowest-numbered open phase** (skipping tasks marked **(user)**), completes
it, ticks it, and rolls on to the next — one atomic commit per task — until
the phase is done or a stop condition hits.

Task format: `- [ ]` unchecked / `- [x]` done. Each task has a **Done:**
criterion — the condition that means it's finished. **(user)** marks a task
only the user can complete (hardware, ears, taste); the loop records it and
moves past it rather than stopping on it.

---

## Where things stand (handoff, 2026-09-21)

**Live:** https://itshendri.github.io/Flux/ — deploys on every push to `main`
(tests gate the deploy; see `DEPLOY.md`). Last deployed commit is whatever is
at `origin/main`.

**The instrument today:** 17 modes, 7 effects, 5 themes, 12 built-in looks.
Vanilla TypeScript + raw WebGL2, zero runtime dependencies, ~63 kB gzipped.
96 unit tests across 16 files.

| Group | Modes |
| --- | --- |
| Reading the signal | `bars` (log spectrum), `waveform` (line / mirror / radial), `spectro` (spectrogram — the only mode with a memory) |
| Fields | `flow`, `cells`, `mandala` (kaliset through a kaleidoscope), `sand` (Chladni plate), `fur`, `logo` |
| Simulations (CustomMode) | `reaction` (Gray-Scott), `fluid` (stable fluids) |
| Raymarched | `raymarch` (iridescent metaballs), `chrome` (reflective metal), `bulb` (Mandelbulb), `lattice` (Mandelbox) |
| Particles (CustomMode) | `magneto` (charged swarm + nebula, rays, cores), `trails3d` (curl-noise) |

Effects: `warp` (MilkDrop feedback), `trails`, `tunnel`, `dither`, `bloom`,
`kaleido`, `scanline`. Looks: cathedral, coral, scope, supernova, ink,
shrine, readout, vault, molten, coat, tape, comet.

**The user's stated taste** (from the feedback rounds — worth knowing before
proposing anything): kaleidoscope is the favourite effect; magneto, trails3d
and reaction are the favourite modes; effects that only change *colour* rather
than the *picture* don't earn their place (quantize, chroma, echo and shock
were all removed for that reason); the performance bar is the primary surface
and the dock panel should not duplicate it.

**To start a new run:** read this section, then `Waiting on the user` and
`Phase 7` below, then `CHANGELOG.md`'s newest entry. Verification recipe
(synthetic audio, the preview-pane quirks, the shader-error trap) is in
`AGENT_LOOP.md` → *Verify*.

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

## Phase 1 — Shader & sound-visualization core — complete

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

- [x] **Palette quantization pass.** *(Retired 2026-09-16 — colour-only, overrode the theme.)* Quantize output to N colours; optional
  band-driven palette shift (e.g. bass rotates hue). Toggleable, N as a control.
  *Done:* quantization visible when on; build + Preview clean.

- [x] **Feedback / trails pass.** Use the ping-pong pair; decay amount as a
  control. *Done:* motion leaves decaying trails when on; build clean.

- [x] **Bloom pass.** Bright-pass + separable Gaussian blur, additive composite;
  intensity + threshold controls. *Done:* highlights bloom when on; build clean.

- [x] **Chromatic aberration pass.** *(Retired 2026-09-16 — folded into `shock`.)* Per-channel UV offset scaled by a control
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

## Phase 2 — Backlog after Phase 1 — complete except the (user) MIDI check

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
- [ ] **(user) Web MIDI — hardware verification (needs the user's Traktor S2).**
  Plug in the controller, learn a knob, confirm it drives a control live and
  the binding survives a reload. *Done:* verified by the user on hardware;
  any fixes committed.

### 2e — Output

- [x] **Performance output — implementation.** Output panel section:
  fullscreen (`canvas.requestFullscreen`) and PiP (`captureStream` → hidden
  `<video>` → `requestPictureInPicture`, teardown on leave, never stacks
  videos); failures surface in the error overlay. *Done:* handlers verified
  firing with errors surfaced cleanly (the embedded Preview browser denies
  fullscreen/PiP at the permission level); build + tests clean.
- [x] **Performance output — real-browser verification (needs the user).**
  In desktop Chrome/Edge: fullscreen engages on the canvas, the PiP window
  shows the live visual and can be dragged to a second display. *Done:*
  verified by the user; any fixes committed. (Verified 2026-06-11 in desktop
  Chrome: fullscreen, PiP window, and live mic audio all confirmed working;
  no fixes needed.)
- [x] **Deploy track (gated).** Produce a self-hostable static `dist/` and
  document hosting options. **Do not** push to any third-party host without
  explicit user approval (org tooling policy). *Done:* `dist/` serves standalone;
  hosting options documented; no third-party push without approval.

## Phase 3 — Performance UI & theming (from the user's waveform-visualizer design) — complete

Design reference: the user's earlier vanilla-JS/WebGL visualizer at
`waveform-visualizer-framer.vercel.app` (no Framer/React despite the name —
same stack as FLUX; what carries over is the UI language, not tech). Liked
elements: the floating centered control pill, upload + mic, and the numbered
theme palettes. Adapted for FLUX, in build order:

- [x] **Audio file playback source.** Reintroduce a file source next to the
  mic through the existing `AudioSource` seam (`src/audio/sources.ts`):
  upload button + drop-anywhere on the stage, decoded via an
  `HTMLAudioElement`/`MediaElementAudioSourceNode` with play/pause (Space)
  and a seek scrubber + time readout. Mic stays the default live input.
  *Done:* a dropped file plays, drives the visuals, scrubs, and can be
  swapped back to mic; build + Preview clean.
- [x] **Global theme palettes + hotkeys.** A small set (~5) of named color
  themes as a typed control (serialises into presets), driving a global
  palette uniform trio that modes blend into their cosine palettes; keyboard
  shortcuts `1`–`5` switch themes, and a general hotkey seam lands with it
  (Space is taken by transport). *Done:* switching themes visibly re-tints
  ≥3 modes; hotkeys work; theme round-trips through a preset; build clean.
- [x] **Floating performance bar.** A bottom-center floating pill
  (translucent dark + `backdrop-filter` blur, fully rounded) hosting the
  live essentials: mic/file source toggle, transport (when file), theme
  swatches, mode cycler, fullscreen + PiP. Auto-hides after idle mouse
  seconds (reappears on move); the right dock panel stays for deep editing
  and can be collapsed independently. *Done:* the bar floats centered over
  the visual, auto-hides on idle, and every control on it works; build +
  Preview clean.

## Phase 4 — True 3D mode (the user's priority visual) — complete

The one visual FLUX hasn't gotten right yet (user: "this was always my
intention"). Target look: flowing 3D structure in the spirit of
melt.graphics' surface-flow trails — real geometry/particles with a camera,
not another fullscreen-shader field. Key research (2026-06-11): the look is
**GPGPU curl-noise particle trails** — ping-pong position/velocity data
textures (a technique FLUX's pipeline already uses for post-FX) + point/line
rendering; canonical references: Barradeau's FBO-particles article,
aadebdeb/imokya curl-noise examples, cabbibo's glsl-curl-noise (all
open-source), Codrops' audio-reactive particles tutorials. The existing
scene-FBO + HDR post chain (bloom, trails, tonemap) is mode-agnostic and
will composite a 3D mode for free.

- [x] **Tech decision spike: raw WebGL2 vs Three.js for the 3D layer.**
  Weigh: FLUX stays zero-dependency and already owns FBO ping-pong + GLSL
  (raw path: ~camera matrix + instanced points, no library) vs Three.js
  (~150 kB min+gzip core; buys camera/controls, GPUComputationRenderer, and
  direct portability of the reference examples). Prototype the smallest
  curl-noise trail demo on the preferred path. **Record the recommendation
  under NEEDS DECISION in CHANGELOG.md and stop for user confirmation** —
  this sets the project's dependency posture. *Done:* working spike +
  recorded decision.
- [x] **Custom-draw mode seam.** Extend the Renderer so a mode can be a
  draw callback into the scene FBO (with optional depth attachment) instead
  of a fullscreen fragment — mirroring how BloomPipeline is special-cased.
  Existing fullscreen modes unchanged. *Done:* a trivial 3D demo mode
  renders through the full post chain; all existing modes pixel-identical;
  build + tests clean.
- [x] **3D mode: curl-noise particle trails.** GPGPU position/velocity
  ping-pong, curl-noise flow field over a parametric host shape, additive
  HDR points/trails; audio: bass → flow speed, uBeat → burst/impulse,
  high → sparkle; steering: particle count / flow scale / trail length;
  camera slow-orbits. *Done:* renders + reacts live, composites through
  bloom/trails, ≥3 meaningful controls, resolution-independent perf story
  (count control), build + Preview clean.

## Phase 5 — The iTunes/MilkDrop lineage (research: REFERENCES.md, 2026-09-16) — complete

From the user's steer: study iTunes' visualizers and their open-source
clones, and act on his read of the current modes — `pulse` isn't a favourite,
`plasma` and `flow` do the same thing for him (he prefers `flow`), and
`kaleido` is his favourite effect. The research found one borrowable codebase
(butterchurn, MIT) and, more usefully, three techniques FLUX can build
natively. Ordered by leverage: the first task unblocks most of the rest.

- [x] **Audio texture: the real spectrum and the waveform.** Upload the
  analyser's FFT and time-domain buffers as a 512×2 R8 texture each frame,
  **using Shadertoy's layout** (row 0 = spectrum, row 1 = waveform, bytes
  normalised 0..1) so reference shaders port with a uniform rename. New
  `uAudio` sampler in `BUILTIN_UNIFORMS` + helpers in `common.glsl`
  (`spectrum(x)`, `wave(x)`). The six scalars stay — they're the musical
  smoothing, and this is the raw material. *Done:* a shader reads
  bin-accurate spectrum and a drawable waveform; existing modes unchanged;
  build + tests clean.

- [x] **Bars stops faking it.** `barHeight()` currently spreads three band
  values across the columns with Gaussian weights plus noise. Replace with a
  real per-column spectrum read (log-frequency bucketed, so the low end
  isn't crushed into two columns), keeping the envelope smoothing per bar so
  it stays musical rather than jittery. *Done:* a swept sine walks the bars
  left to right; build + Preview clean.

- [x] **Warp-feedback post-pass — MilkDrop's signature.** A pass that samples
  `uPrevFrame` through a displaced UV field, with Geiss's vocabulary as
  controls: zoom, rot, warp, dx/dy, cx/cy, decay (defaults per the authoring
  guide: zoom 1.0, warp 1.0, decay 0.98). Per pixel rather than MilkDrop's
  coarse vertex mesh. Audio drives zoom/rot; `uBeat` kicks the warp.
  *Done:* enabling it produces tunnels/spirals that hold structure over
  frames, composes with kaleidoscope, and is a no-op when off; build clean.

- [x] **New mode: waveform — the classic iTunes read.** *(Replaces `pulse`
  — user confirmed 2026-09-16.)* The time-domain waveform
  drawn as a glowing line with mirror symmetry, a radial/Lissajous option,
  and history offsets so the line leaves a ribbon. Depends on the audio
  texture. *Done:* the drawn line visibly tracks the waveform (a sine reads
  as a sine); ≥3 controls; build + Preview clean.

- [x] **Re-cast `plasma` as Gray-Scott reaction-diffusion.** *(User
  confirmed 2026-09-16: re-cast, don't retire.)* It and `flow` are both
  domain-warped fbm today. Replace its internals with a real ping-pong
  simulation — organic growth rather than a noise field — with feed/kill
  rates driven by the bands. *Done:* the pattern grows and reacts, mode
  switching in and out reseeds cleanly, build + Preview clean.

- [x] **New 3D mode: magnetosphere.** Hodgin's charged-particle physics on
  the existing `trails3d` GPGPU rig: per-particle charge, attractors and
  repulsors, and **per-particle frequency assignment** from the audio
  texture so each particle answers to its own bin. Additive HDR points, no
  depth sort. *Done:* the swarm forms and breaks up on the music with ≥3
  controls; composites through bloom/trails; build + Preview clean.

- [x] **Built-in looks — curated combos.** The user's open question is which
  effect combinations are worth using; answer it in the product rather than
  leaving him to hunt. Ship ~6 named built-in presets (mode + pass chain +
  control values + theme), kaleidoscope-forward, loaded alongside the user's
  own in the Presets section and cyclable from the performance bar.
  *Done:* each built-in look loads and looks distinct; user presets are
  untouched; build + tests clean.

---

## Phase 6 — Feedback rounds and the photism modes (2026-09-16 → 09-18) — complete

The user's notes after using the deployed build: the bar is right, so the dock
panel's copies of it can go; reaction wants finer lines; raymarch wants more
colour and movement; and several effects "affect the colour rather than the
visual". Research round two (REFERENCES.md) looked for structural effects.

- [x] **Trim the panel.** Level meters and the Mode section removed; the bar's
  mode name opens a picker so direct selection isn't lost.
- [x] **Reaction detail.** Detail (simulation resolution = line thickness),
  named Pattern regimes, speckle seeding, colour varying across the field.
- [x] **Raymarch colour + motion.** Thin-film iridescence (the iTunes nebula
  sheen), six Lissajous satellites, travelling ripple.
- [x] **From the photism sweep (2026-09-18).** `mandala` (kaliset
  through a kaleidoscope) and `sand` (a Chladni plate driven by the spectral
  centroid) added; `reaction` gains Symmetry. Their remaining scenes are
  logged in REFERENCES.md as directions, not commitments.
- [x] **fluid (2026-09-18).** Stam's stable-fluids solver — advect, vorticity
  confinement, Jacobi pressure projection — with the music entering only
  through splats. Ships with the `ink` look.
- [x] **bulb (2026-09-18).** The Mandelbulb, sphere-traced by distance
  estimate, with the music moving the exponent so accents re-grow it. Ships
  with the `shrine` look.
- [x] **spectro (2026-09-18).** A spectrogram on a ring buffer of columns —
  FLUX's first mode with a memory. Ships with the `readout` look.
- [x] **lattice, chrome, fur (2026-09-18).** The Mandelbox from outside,
  reflective molten metal, and shell-rendered fur. Ship with the `vault`,
  `molten` and `coat` looks — which closes the photism list except the
  goniometer, which needs stereo.
- [x] **Structural effects.** `tunnel`, `echo` and `shock` added; `quantize`
  and `chroma` retired. After live use, `echo` and `shock` removed too —
  only `tunnel` earned its place.

---

## Waiting on the user

Things only the user can close. They stay open until he reports back.

- **Web MIDI on hardware** — the Traktor S2 check, tracked as the open
  **(user)** task in Phase 2d: learn a knob, confirm it drives a control live
  and survives a reload.
- [ ] **(user) Live taste pass in Chrome with real music.** The embedded
  preview pane only renders frames while it captures, so feedback, trails and
  bloom never accumulate there and sustained frame rate can't be judged. Worth
  the user's eye in particular:
  - **sand** — does the figure redraw at chord changes on real tracks, and
    hold still in between? It was only tested with synthetic tone steps; the
    centroid mapping (`(balance - 0.18) / 0.5`) may need widening.
  - **comet / trails3d** — dim in the pane; should be brighter live.
  - **magneto** — where Charge stops being a swarm and becomes a starfield.
  - **bulb, lattice, fluid Ultra, reaction Ultra** — 120 fps on the dev
    machine (Apple silicon) only; unknown on weaker GPUs.

---

## Phase 7 — Next up (2026-09-21)

Approved by the user on 2026-09-21: build all of it, autonomously, with a
self-review of each task. Order taken: picker, stereo + goniometer, forge,
synapse, governor, then the unscoped photism directions. Each is sized to one
commit unless noted.

- [x] **Stereo analysis + goniometer mode.** *(Shipped as `vector` — a look
  called `scope` already existed — with the `phosphor` look.)* The one photism direction FLUX
  can't do yet: the analyser is mono. Split the source into L/R
  (`ChannelSplitterNode` → two analysers), add a stereo waveform to the audio
  texture (a third row, or a second texture), and a `scope` mode plotting L
  against R (the goniometer / vectorscope). Engine change, likely two commits
  (engine, then mode). *Done:* a hard-panned tone draws a vertical/horizontal
  line, a mono signal a diagonal, a wide stereo pad a cloud; mono sources still
  work; tests cover the channel packing.
- [x] **Performance governor.** Most heavy modes now have a Quality/Detail
  control, but nothing lowers it when a machine struggles. Watch frame time and
  step the active mode's quality down (and back up) with hysteresis. *Done:*
  forcing a low frame budget steps quality down within ~2 s and back up when
  headroom returns; no oscillation; the user can pin quality to opt out.
- [x] **Group the mode picker.** 17 modes in a flat 3-column grid is getting
  long. Group it by the table above (signal / fields / simulations / raymarched
  / particles). *Done:* picker shows labelled groups, keyboard/click selection
  unchanged, cycler order matches.
- [x] **forge** — "a chrome swarm that builds a shape and breaks it apart"
  (photism). Magneto's particle rig with chrome's reflective shading and a
  target-shape attractor that kicks shatter. *Done:* the swarm assembles into a
  recognisable shape and a kick scatters it; ≥3 controls; ≥60 fps at default.
- [x] **synapse** — "every hit adds a node to a growing constellation"
  (photism). The first mode that *accumulates* structure over a track. *Done:*
  nodes appear on onsets and connect; the constellation grows over a minute and
  resets cleanly on mode re-entry.
- [x] **Remaining photism directions — scoped (2026-09-21).** Split into the
  seven tasks below. Two overlap existing work, so each is scoped to be
  clearly different from what's there.
- [x] **anemone** — "chains of rings from one point". Instanced 3D rings (an
  annulus on a quad in the ring's own plane) strung along tentacles that leave
  one centre and curl on noise; ring *n* of a chain answers to band *n*, so
  the spectrum runs out along every arm. *Done:* arms visibly carry the
  spectrum outward; bass sways them; ≥3 controls.
- [x] **gate** — "falling through a corridor of gates". Raymarched, domain-
  repeated gate frames along the camera's path, neon-edged; speed from bass,
  each kick lights the next gate. *Done:* sustained forward motion through
  distinct gates; the kick-lit gate is readable; ≥3 controls.
- [x] **grove** — "a fractal forest". 2D KIFS trees (fold-and-rotate
  iterations) in parallax layers; band energy sets branch angles so the
  canopy re-grows with the music, wind from bass. *Done:* reads as trees, not
  noise; the spectrum visibly reshapes branches; ≥3 controls.
- [x] **wisp** — "a dust world with one bright wanderer". Dust placed
  analytically in the vertex shader (no simulation) and lit by inverse-square
  distance to a single wandering light whose path the music drives. *Done:*
  the light moves through the dust and lights what's near it; kicks make it
  dart; ≥3 controls.
- [ ] **oracle** — "an edge-lit dark chamber". A raymarched interior lit only
  along its edges (normal discontinuity → glow), with the spectrum running
  around the edge light. *Done:* reads as a dark room drawn in light at its
  edges; ≥3 controls.
- [ ] **spacetime** — "neon rays rushing past". A fragment mode of radial
  streaks with depth and parallax, speed from bass, hue from band. Unlike the
  `tunnel` effect (which bends whatever mode is showing) this is a scene of
  its own. *Done:* reads as rushing forward; kicks surge; ≥3 controls.
- [ ] **limitless** — "your image warped by the music". The uploaded image
  (the `logo` texture) as a Droste spiral: log-polar tiling so it contains
  itself forever, zoom speed from bass, twist from the mids; a generated
  pattern stands in until an image is uploaded. *Done:* an uploaded image
  recurses into itself and the zoom follows the music; ≥3 controls.

---

## Known limitations

- **Mono analysis only.** One `AnalyserNode` on a mixed-down signal; nothing
  stereo is available to shaders (see Phase 7).
- **Heavy modes are only measured on one machine.** Raymarched fractals and
  the Ultra settings of the simulations held 120 fps on Apple silicon; there's
  no data for integrated or older GPUs, and no automatic fallback yet.
- **The preview pane can't judge accumulation or frame rate** (see *Waiting on
  the user*). Verify those in real Chrome.
- **A failed shader compile is quiet.** FLUX keeps the last good program, so
  the mode keeps rendering the *previous* shader; only the on-screen error
  overlay says so. Always check it after a shader edit (`AGENT_LOOP.md`).
- **Editing a `.frag` owned by a CustomMode reloads the page** (Vite HMR can't
  hot-swap it the way it swaps `modes.ts` fragments), which drops a loaded
  audio file. Re-drop the file after such edits when verifying.

Resolved from the Phase 1 audit: parallel toggle mechanisms (2c), RGBA8
clamping and resolution-dependent bloom (2a), Bayer banding (2a dither
options), the stale mic-only comment in `AudioEngine.ts`, and the missing
per-mode quality controls (bulb, lattice, fluid, reaction now have them).

---

## Notes for the loop

- Work the lowest-numbered open phase first, one atomic commit per task, and
  stop at the end of that phase with a review note in `CHANGELOG.md`.
- Skip **(user)** tasks — don't stop on them; they're recorded for the user.
- If a task needs a human product decision (removing or replacing something
  the user has, or a direction he hasn't chosen), **stop and record the
  question under `NEEDS DECISION` in `CHANGELOG.md`** rather than guessing.
- Keep tasks small enough to finish as one commit. If a task is too big, split
  it into 2–3 smaller `- [ ]` tasks and commit that planning change first.
- **Never push** unless the user asks — pushing to `main` deploys the live site.
