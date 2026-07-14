# FLUX Changelog

Plain-English log of every completed task, newest first. Each loop iteration
adds one entry (see `AGENT_LOOP.md`).

---

## Docs — consolidated research log + README refresh

Session-closing documentation pass: new [`REFERENCES.md`](REFERENCES.md)
consolidates every reference review (the user's waveform visualizer,
melt.graphics, fieldtone, rapidflow/Sphere V3, p5.js), the browser-VJ
landscape sweep, the GPGPU curl-noise technique sources feeding Phase 4, and
the settled **stack posture** (vanilla TS + raw WebGL2, zero runtime deps; no
React, no Framer, no p5; Three.js deferred to the Phase 4 decision gate).
README updated from its Phase 1 snapshot to the current feature set and
architecture (HDR pipeline, beat detection, presets, MIDI, logo, output) and
now indexes all docs. No code changes.

---

## Planning — Phase 4 backlog: true 3D mode + research-source expansion

Landscape research pass over the user's references and the wider category.
Findings: the browser VJ/visualizer space (Hydra, cables.gl, Butterchurn/
MilkDrop, Shadertoy; commercial: Resolume, TouchDesigner, Synesthesia) runs
on the same WebGL foundations FLUX uses — no stack change indicated. The
melt.graphics look the user wants (flowing 3D trails) is the documented
**GPGPU curl-noise particle** technique (Barradeau FBO particles, cabbibo
glsl-curl-noise, Codrops audio-reactive particle tutorials — open source).

- New **Phase 4 — True 3D mode** roadmap group: tech-decision spike (raw
  WebGL2 vs adopting Three.js — gated on user confirmation), a custom-draw
  mode seam in the Renderer, then a curl-noise particle-trails mode
  composited through the existing HDR post chain.
- `AGENT_LOOP.md` research sources expanded per user request: p5.js
  showcase + OpenProcessing (port ideas as native GLSL, never adopt the
  library), Codrops, three.js forum showcases.
- The melt.graphics HUD *styling* direction was reviewed and **rejected by
  the user** — Phase 3's floating bar keeps the user's own waveform-
  visualizer design language instead.

---

## Planning — Phase 3 backlog: performance UI & theming

Reviewed the user's earlier visualizer
(`waveform-visualizer-framer.vercel.app`) as a design reference. Tech
finding: it's a single vanilla-JS + WebGL canvas page (no Framer or React
despite the name) — the same stack FLUX uses, so only the UI language carries
over. Three liked elements adapted into a new **Phase 3** roadmap group with
Done criteria: an audio **file playback source** (drop-anywhere + transport +
scrubber, via the existing `AudioSource` seam), **global theme palettes with
1–5 hotkeys** (typed control, preset-serialisable, re-tinting mode palettes),
and a **floating bottom-center performance pill bar** (translucent blur,
auto-hide on idle) complementing the editing dock. Planning change only —
no implementation yet.

---

## Phase 2e — Performance output verified in a real browser

User verification (2026-06-11, desktop Chrome): **fullscreen** engages on the
canvas, the **PiP window** appears with the live visual, and **mic audio**
drives the visuals — the parts the embedded Preview browser couldn't exercise.
No fixes were needed; the roadmap task is ticked. The only remaining
user-gated item in Phase 2 is the **Web MIDI hardware check** (Traktor S2),
deferred until the user has the controller at hand.

---

## PHASE 2 COMPLETE — review

Phase 2 is done: every backlog group (2a–2e) landed as verified atomic
commits, two items carry explicit user-verification follow-ups. What landed:

- **2a Rendering quality** — HDR RGBA16F FBOs + tonemapped present pass
  (None/Reinhard/ACES), Jimenez 2014 mip-chain energy-conserving bloom
  (resolution-independent), dither noise options (Bayer/IGN/blue-noise CC0
  texture + temporal animation). All three Phase 1 audit debts in this area
  resolved.
- **2b Audio** — spectral-flux beat/onset detection; `uBeat`/`uOnset` pulse
  uniforms in every shader; cells flashes on the kick.
- **2c State/UX** — pass toggles unified into the serialisable control store
  (parallel-toggle debt resolved), then presets: save/recall mode + controls
  + effects to localStorage with stable-id keys.
- **2d Input** — logo upload (`uLogo` sampler + audio-reactive logo mode) and
  Web MIDI learn (engine + bindings persisted; **hardware verify on the
  user's Traktor S2 still unchecked**).
- **2e Output** — fullscreen + PiP performance output (**real-browser verify
  still unchecked**; the embedded preview denies both), and the gated deploy
  track: `dist/` verified standalone, hosting documented in
  [`DEPLOY.md`](DEPLOY.md), nothing pushed anywhere.

Quality bar held throughout: research-first with citations in commits, one
atomic commit per task, every commit gated on build + tests (40 now, up from
12) + Preview screenshot + empty error overlay + clean console. Tech debt
list from the Phase 1 audit is fully cleared. Open items for the user: the
two hardware/real-browser verifications above, plus tuning taste passes
(bloom intensity, beat sensitivity) best done live with music.

---

## Phase 2e — Deploy track (gated)

`dist/` is a fully static, self-hostable bundle — verified standalone: built
fresh and served via a plain `python3 -m http.server`; `index.html` and all
three hashed assets (JS, CSS, blue-noise PNG) return 200 with no other
server features needed. New [`DEPLOY.md`](DEPLOY.md) documents requirements
(HTTPS/localhost for mic + MIDI + PiP; root-path assumption and the `base`
option for subpaths) and hosting options: local `vite preview`, python,
nginx, and **gated** hosted candidates (company GitLab Pages) per the org
policy — no third-party push without explicit approval, and none was made.

---

## Phase 2e — Performance output (real-browser verify pending)

An **Output** panel section for performing:

- **fullscreen** — `canvas.requestFullscreen()` on the stage canvas.
- **pip window** — `canvas.captureStream(60)` → hidden muted `<video>` →
  `requestPictureInPicture()`; the floating window can be dragged onto a
  second display while the control panel stays put. Click again to close;
  teardown stops the capture tracks and removes the video (and a fresh
  request never stacks videos if a previous one is still pending).
- Unsupported/denied paths surface in the error overlay.

Verified: build clean, 40/40 tests; Preview confirms the section renders and
the handlers fire with failures surfaced cleanly — the embedded Preview
browser **denies fullscreen/PiP at the permission level** ("Permissions check
failed"), so the visible-output half is split into a real-browser
verification task in the roadmap, like the MIDI hardware check. (Also noted:
the preview viewport had collapsed to 0×0 mid-session — an environment
quirk, fixed by a resize, unrelated to the app.)

---

## Phase 2d — Web MIDI engine + learn UI (hardware verify pending)

Hardware knobs/faders can drive the visuals: `src/audio/midi.ts` provides a
**MIDI-learn** pipeline, split for testability — `parseMidi` (CC extraction)
and `MidiMap` (learn/route/scale, one binding per control and per CC) are
pure; `MidiEngine` wraps `requestMIDIAccess` with hot-plug tracking;
`MidiBindingStore` persists bindings by stable `ControlDef.id`.

- **MIDI panel section** — connect button (permission on demand), status line
  (devices / unsupported / errors), control picker + learn button
  ("twist a knob…"), a chip per binding with unbind ×.
- CC values scale into the bound slider's min/max with step snapping, applied
  through `ControlPanel.applyValues` so the widget moves live.
- Degrades cleanly: no Web MIDI (Safari) → status note, no devices → hint.

Verified: build clean, 40/40 tests (parse, scaling, learn/rebind/unbind,
persistence incl. corrupt JSON); Preview with a simulated CC stream through
the real handler: learn binds Gain ← CC21 (chip + localStorage), CC values
127/32/96 move the slider + readout live, the binding routes after a page
reload without re-learning, unbind clears storage; overlay empty, console
clean. **The hardware half of the original task stays unchecked in the
roadmap** — needs the user's Traktor S2 on a real session.

---

## Phase 2d — Logo / image upload

FLUX can now perform around a brand mark: a **Logo** panel section uploads an
SVG/PNG/JPEG/WebP, rasterised to a capped 1024px canvas and pushed into a new
**`uLogo`** sampler (texture unit 4, available to every mode *and* pass), with
**`uLogoAspect`** as a builtin (0 = nothing uploaded yet).

- **Renderer** — `setLogo(canvas|image|bitmap)` uploads with a vertical flip
  (shader UVs are bottom-left), LINEAR/CLAMP, placeholder 1×1 transparent
  black; `MODE_SAMPLERS` joins the compose path so modes get samplers for the
  first time.
- **New `logo` mode** — aspect-fit display with a bass-driven radial ripple,
  scale pop on `uBeat`, per-channel shimmer on highs, over a slow hue-drifting
  glow field; a breathing placeholder ring shows before any upload. Scoped
  controls: Scale (shared) + Ripple.
- **main.ts** — upload button → object URL → `img.onload` → capped canvas →
  `setLogo`, then auto-switches to the logo mode. Decode failures surface in
  the error overlay. (`img.decode()` was rejected after testing: it never
  settles for blob URLs in some embedded browsers; `onload` is equivalent and
  reliable.)

Verified: build clean, 32/32 tests; Preview end-to-end through the real file
input (a generated PNG injected via DataTransfer): logo mode auto-activates,
the image renders upright/aspect-correct with Scale + Ripple controls, button
shows the filename; error overlay empty, console clean. Audio reaction rides
uBass/uBeat/uHigh, the same uniforms proven live in the Phase 2b check.

---

## Phase 2c — Presets (localStorage save / recall)

Live state is now capturable: a **Presets** panel section saves the active
mode + every control value (pass toggles included, thanks to the toggle
unification) under a name, recalls it with one click, and deletes with ×.

- **`src/presets/presets.ts`** — pure + tested: `snapshotPreset` /
  `resolvePreset` translate between the live store (keyed by `glslName`) and
  the persisted shape (keyed by stable `ControlDef.id`, the contract that
  survives uniform renames); ids missing from either side are skipped, so old
  presets stay loadable across schema changes. `PresetStore` wraps a `Storage`
  (localStorage in app, a stub in tests) under one JSON key
  (`flux.presets.v1`); corrupt JSON degrades to empty.
- **`ControlPanel.applyValues`** — programmatic batch apply that also repaints
  each widget (slider position/readout, toggle label, select actives, color
  swatch) via per-widget apply hooks.
- **`src/ui/PresetPanel.ts`** — name field + save, chip-per-preset list
  (click = recall, × = delete); `main.ts` wires recall to mode switch +
  `applyValues` + Effects-row repaint.

Verified: build clean, 32/32 tests (round-trip incl. colors + pass toggles,
unknown-id tolerance, store CRUD, corrupt-JSON); Preview end-to-end: set
cells + bloom + trails + Gain 0.9 → save "club" → scramble to bars/all-off/
Gain 0.1 → load → mode, both effects, slider position and readout all
restore, scoped controls reappear; preset survives a page reload; delete
removes it; error overlay empty, console clean.

---

## Phase 2c — Pass toggles unified into the control system

Resolved the Phase 1 "parallel toggle mechanisms" tech debt: pass-enable state
now lives in the same typed, serialisable store as every other control —
the prerequisite for presets.

- **`passToggleDefs` / `passToggleUniform`** (`src/core/state.ts`, pure +
  tested) generate one `toggle` ControlDef per pass (`uFxTrails`, `uFxBloom`,
  …). They're handed to the Renderer (declared like any control uniform) and
  seeded **widgetless** into the ControlPanel value store — the existing
  Effects button row stays the UI, writing through new
  `ControlPanel.setValue`/`getValue`.
- **Renderer** — the private `enabled` Set and `setPassEnabled`/`isPassEnabled`
  API are gone; the chain is derived per frame from `FrameState.controls`
  (`uFx* >= 0.5`). Pass-enable state has exactly one home.
- `ControlPanel.getValues()` (→ `FrameState.controls`) is now the complete
  serialisable snapshot of live state apart from the mode name.

Verified: build clean, 27/27 tests; Preview behaviour unchanged — Effects
buttons toggle bloom/trails on (raymarch renders the full chain, scoped
controls appear) and off (controls disappear, base render returns); error
overlay empty, console clean on a fresh server.

---

## Phase 2b — Beat / onset detection (spectral flux)

FLUX now *fires on hits* instead of only tracking continuous energy. Two new
builtin uniforms: **`uBeat`** (bass-band transient — the kick) and **`uOnset`**
(full-spectrum transient), each a 0..1 pulse that snaps to 1 on a hit and
decays exponentially (~6/s), so shaders get a usable flash envelope for free.

- **`src/audio/OnsetDetector.ts`** — pure, testable: half-rectified spectral
  flux (sum of per-bin rises, normalised), adaptive threshold = trailing-mean
  of recent flux × 1.5, plus a 120 ms refractory gap and a noise floor.
  Adapted for causal/live use from the offline reference (mean window ×1.5,
  peak picking) in Keavon/Web-Onset, after the badlogic onset tutorial — live
  detection has no lookahead, so trailing window + refractory replaces peak
  picking. Band-limitable: `beat` uses 20–250 Hz (matches `bands.ts` bass),
  `onset` the full spectrum.
- **AudioEngine** — two detectors run in `tick()` off the existing analyser
  data (no extra FFT); reset on source change. Also fixed the stale "file,
  test tone" monitoring comment (logged Phase 1 debt).
- **Renderer** — `uBeat`/`uOnset` added to `BUILTIN_UNIFORMS`, uploaded from
  the frame; declared in every mode and pass header.
- **cells mode** reacts: borders flash white and brightness pops on `uBeat`.
- **Tests** — 8 OnsetDetector cases (silence, steady tone, jump→pulse=1,
  exponential decay, refractory block + re-arm, band isolation, reset);
  25 total.

Sources: [Keavon/Web-Onset](https://github.com/Keavon/Web-Onset) (flux +
mean-window threshold, verified against its source),
[badlogic onset-detection tutorial](https://github.com/badlogic/onset-detection),
[audiojs/beat-detection](https://github.com/audiojs/beat-detection).

Verified: build clean, 25/25 tests; Preview on cells with a session-only
synthetic uBeat pulse (reverted, like the Phase 2a RGBA8 check) shows the
border flash + brightness pop clearly between peak and trough frames; error
overlay empty, console clean. Live-mic behaviour rides the same tested path.

---

## PHASE 2a COMPLETE — checkpoint (run ended on context hygiene)

All three §2a rendering-quality upgrades landed as verified atomic commits:
HDR RGBA16F FBOs + tonemapped present pass, the Jimenez 2014 mip-chain
energy-conserving bloom, and the Bayer/IGN/blue-noise dither options. All
three Phase 1 audit debts in this area are resolved. The run stopped here per
the loop protocol (several tasks completed; fresh context resumes seamlessly).
**Next unchecked task: §2b beat/onset detection via spectral flux.**

---

## Phase 2a — Dither quality options (IGN + blue noise)

The dither pass gains a **Dither Noise** select alongside the Bayer matrices,
addressing the audit note that Bayer shows structured lines in static frames:

- **Bayer** (default, unchanged) — most temporally stable in motion.
- **IGN** — Jimenez's interleaved gradient noise (SIGGRAPH 2014), procedural
  (one dot + two fracts), diagonal-gradient character, far less structured.
- **Blue Noise** — samples a tileable 128×128 threshold texture from Christoph
  Peters' public-domain set (`src/assets/blue-noise-128.png`, **CC0**,
  momentsingraphics.de/BlueNoise.html); structureless grain, best static look.
- **Animate Noise** toggle — re-seeds the pattern each frame (Jimenez's
  golden-ratio-flavoured offset, 64-frame cycle) for temporal averaging.

Plumbing: `PASS_SAMPLERS` gains `uBlueNoise` on texture unit 3, bound for every
pass like the other samplers (unused declarations are free, matching the
controls convention). The texture allocates as 1×1 mid-grey and upgrades when
the PNG decodes (NEAREST + REPEAT — exact thresholds, free tiling); a load
failure routes to the error overlay. Dither Matrix (2/4/8) still applies to
Bayer only.

Sources: [demofox on IGN](https://blog.demofox.org/2022/01/01/interleaved-gradient-noise-a-different-kind-of-low-discrepancy-sequence/),
[Bart Wronski: dithering pt 3](https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/),
[momentsingraphics.de blue noise (CC0)](https://momentsingraphics.de/BlueNoise.html)
(via the [Calinou mirror](https://github.com/Calinou/free-blue-noise-textures)).

Verified: build clean (PNG bundles), 17/17 tests; Preview on plasma cycles
Bayer → IGN → Blue Noise with clearly distinct pattern character (cross-hatch →
fine diagonal grain → structureless grain), Animate Noise toggles, the PNG
loads (no 404), error overlay empty, console clean on a fresh server.

---

## Phase 2a — Mip-chain / energy-conserving bloom

Replaced the fixed-resolution separable Gaussian bloom with the Jimenez 2014
(SIGGRAPH, "Next Generation Post Processing in Call of Duty: Advanced Warfare")
downsample→upsample pyramid — the wide, stable, resolution-independent glow
modern engines use, fed by the new HDR buffers.

- **`src/render/BloomPipeline.ts`** — a half-res FBO pyramid (≤6 levels, ≥8 px):
  progressive 13-tap downsample (Karis luma-weighted on the first mip to kill
  fireflies), progressive 3×3 tent upsample accumulated with additive blending,
  full-res composite. The pyramid allocates lazily (no VRAM while bloom is off)
  and resizes itself. The Renderer special-cases the pass named `bloom` to this
  pipeline — a pyramid genuinely doesn't fit the full-res ping-pong stage model
  — while the registry keeps the toggle, chain order, controls and `.frag` HMR.
- **Shaders** — `bloom-down/up/composite.frag` replace `bloom-h/v.frag`. Stage-
  private uniforms (`uFirstMip`) are declared in the `.frag` body, a documented
  seam under the shared header.
- **Controls** — `Bloom Threshold` default **0** with new semantics (0 = no
  bright-pass, fully energy-conserving; >0 = soft knee), per review decision.
  New `Bloom Radius` (tent footprint). `Bloom Intensity` retuned to 0.8 against
  the pyramid's internal 0.3 normalisation.
- **Tests** — `computeMipSizes` is pure and covered (17 tests total now).

Sources: [Jimenez 2014 slides](https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/),
[LearnOpenGL: Phys. Based Bloom](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom),
[Froyok: UE custom bloom](https://www.froyok.fr/blog/2021-12-ue4-custom-bloom/).

Verified: build clean, 17/17 tests; Preview on raymarch shows the wide soft
halo + ambient bleed; glow stays proportional at 640×400 vs. desktop
(resolution-independent — the old Gaussian's radius was fixed in texels);
toggle off restores the base image; error overlay empty, console clean on a
fresh server.

---

## Phase 2a — HDR float-FBO pipeline

All five off-screen render targets (scene, ping, pong, history, passInput) are
now **RGBA16F** where the hardware can render to float, so bloom and trails
accumulate real energy past 1.0 instead of plateauing at the old RGBA8 clamp.

- **Format detection** (`Framebuffer.ts: detectFboFormat`) — try
  `EXT_color_buffer_float`, fall back to `EXT_color_buffer_half_float`
  (16F-only devices), and verify with a probe FBO + `checkFramebufferStatus`
  before trusting it; otherwise a clean RGBA8 fallback. Half-float **linear
  filtering is core WebGL2**, so the roadmap's `OES_texture_half_float_linear`
  (a WebGL1 extension) is not needed — correction noted from research.
- **Present pass replaces the present blit** (`src/shaders/present.frag`).
  ES 3.0 forbids `blitFramebuffer` from a float read buffer to the fixed-point
  default framebuffer, so the final present is now a fullscreen draw — used on
  the RGBA8 path too (one code path). It carries the new global **Tonemap**
  select (None / Reinhard / ACES-approx, Narkowicz 2015), default **None** so
  this lands look-neutral; flip to Reinhard/ACES to resolve HDR highlights.
- FBO→FBO blits (history, passInput) stay blits — same-format, legal.
- Known/accepted: `dither`/`quantize` clamp internally (LDR stylisation passes
  flatten HDR headroom downstream of themselves); FBO memory ×2.

Sources: [MDN EXT_color_buffer_float](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float),
[Khronos EXT_color_buffer_half_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_half_float/),
[Khronos blitting rules](https://www.khronos.org/opengl/wiki/Blitting),
[Narkowicz ACES fit](https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/).

Verified: build clean, 12/12 tests; Preview on raymarch + trails + bloom renders
through the new path (error overlay empty, console clean), Reinhard visibly
recovers highlight detail that clips under None (HDR values reach the present
pass), and a session-forced RGBA8 fallback renders identically clean.

---

## PHASE 1 COMPLETE — review

Phase 1 (shader & sound-visualization core) is done — all 13 tasks landed, each
as its own verified atomic commit. What FLUX has now:

- **Multi-pass pipeline** — the active mode renders into an off-screen FBO, then
  an ordered, individually-toggleable post-pass chain runs across a ping-pong
  pair (with a history FBO for feedback and a `uScene` snapshot for multi-stage
  passes), blitted to screen.
- **7 post-effects**, each toggleable with live controls: trails (feedback),
  Bayer dither, palette quantize (+ bass hue shift, cycle, tint), bloom
  (separable Gaussian), chromatic aberration, kaleidoscope, scanline/VHS.
- **6 modes** — bars, pulse, plasma, plus three research-led additions:
  raymarched SDF metaball (iq raymarching/smin), domain-warp flow field (iq
  domain warping), and a Voronoi cells field (iq Voronoi edges).
- **Typed controls** — slider / toggle / select / color, each driving the right
  uniform (float or vec3).
- **Context-aware control panel** — shows only the controls relevant to the
  active mode and the enabled passes, so live steering stays focused.

Everything is audio-reactive (bass/mid/high/level) and steerable while sound
plays. Next is the Phase 2+ backlog (beat detection, presets, logo upload, MIDI,
performance output, gated deploy) — **paused here for review** per the loop
protocol; the backlog is not started.

**Session review:** see [`PHASE-1-REVIEW.md`](PHASE-1-REVIEW.md) for the code
audit (no critical bugs), technique re-validation against current best practice,
logged tech debt, and the refined/prioritized Phase 2 backlog in
[`ROADMAP.md`](ROADMAP.md).

---

## Phase 1 — Per-mode controls + live-steering polish

Made the control panel context-aware and gave every mode a distinctive set.

- **Scoping** — `ControlDef` gains optional `modes` / `pass`. The panel
  (`ControlPanel.update`) now shows a control only when its mode is active /
  its pass is enabled, so live steering reflects exactly what's adjustable. The
  uniform is still always declared + uploaded. `main.ts` refreshes on mode
  switch and effect toggle. Shared Warp/Scale are scoped to the modes that use
  them.
- **Per-mode controls** — each mode now exposes ≥3 meaningful controls including
  a distinctive one: bars → Bar Count + Bar Glow, pulse → Petals, plasma →
  Veins, raymarch → Glow, flow → Turbulence, cells → Edge Glow. New uniforms
  wired into each `.frag`.

Verified: `npm run build` clean, 12/12 tests pass; Preview confirms each mode
shows only its relevant controls (bars: Gain/Bar Count/Bar Glow; raymarch:
Gain/Warp/Scale/Glow; etc.), pass controls appear/disappear with their toggle,
error overlay empty, console clean on a fresh server.

---

## Phase 1 — New mode: Voronoi cells (trending technique)

Picked an audio-reactive **Voronoi cellular** field — the organic, shifting
cellular look that's ubiquitous in modern audio-reactive motion work.

- **`src/shaders/modes/cells.frag`** — two-pass Voronoi: pass 1 finds the
  nearest cell, pass 2 measures distance to the border between it and its
  neighbours. Each cell's feature point orbits over time (faster on bass); cells
  are tinted from a cosine palette by id, borders glow (mid), cell cores sparkle
  (high). `uScale`/`uWarp`/`uGain` steer density/orbit/brightness.
- Registered as the `cells` mode.

Source: Inigo Quilez — Voronoi edges
(https://iquilezles.org/articles/voronoilines/). Verified: `npm run build`
clean, 12/12 tests pass, Preview shows a vivid glowing-edged cellular field in
the switcher, error overlay empty, no console errors.

---

## Phase 1 — New mode: domain-warp flow field

- **`src/shaders/modes/flow.frag`** — recursive domain warping (`fbm` of `fbm`
  of `fbm`): each level displaces the next level's sampling position, the
  intermediate warp vectors `q`/`r` drive the colour, and advecting them over
  time makes the field churn like slow fluid. Coloured deep violet → ember with
  blue/teal accents (iq's q/r colouring) plus a mid-driven hue tint and
  high-sharpened filaments. Audio: bass adds turbulence, mid shifts hue, high
  sharpens detail, level drives brightness; `uScale`/`uWarp`/`uGain` steer
  zoom/warp/brightness. Visually distinct from `plasma` (single-level warp).
- Registered as the `flow` mode.

Source: Inigo Quilez — domain warping
(https://iquilezles.org/articles/warp/). Verified: `npm run build` clean, 12/12
tests pass, Preview shows a turbulent marbled fluid field in the switcher, error
overlay empty, no console errors.

---

## Phase 1 — New mode: raymarched SDF

The first 3D mode — an audio-reactive metaball blob via signed distance fields.

- **`src/shaders/modes/raymarch.frag`** — sphere-traces a scene SDF: a pulsing
  core smooth-unioned (iq `smin`) with three orbiting spheres, plus high-
  frequency surface displacement. Lit with diffuse + rim + specular, coloured by
  a cosine palette, with an additive proximity glow. Audio wiring: bass pulses
  the core, mid drives surface wobble, high adds shimmer/specular, level drives
  the glow. Steering reuses `uScale` (zoom), `uWarp` (spin), `uGain`
  (brightness), so it's expressive without sound.
- Registered as the `raymarch` mode in `modes.ts`.

Sources: Inigo Quilez — raymarching distance fields
(https://iquilezles.org/articles/raymarchingdf/), distance functions
(https://iquilezles.org/articles/distfunctions/), smooth-min
(https://iquilezles.org/articles/smin/). Verified: `npm run build` clean, 12/12
tests pass, Preview shows a lit, glowing 3D metaball blob in the switcher, error
overlay empty, no console errors.

---

## Phase 1 — Control-type expansion

The control schema was slider-only; now it supports four widget/uniform types.

- **`ControlDef.type`** (`src/core/state.ts`): `'slider' | 'toggle' | 'select' |
  'color'`, defaulting to `'slider'` so existing entries are untouched. `select`
  adds `options: {label, value}[]`; `color` drives a **`vec3`** uniform (others
  drive `float`). FrameState.controls values are now `number | number[]`.
- **`ControlPanel`** branches on type: slider (range), toggle (on/off button),
  select (button group), color (native swatch). Hex⇄rgb conversion for colors.
- **`Renderer`** now takes the control defs (not just glsl names): it declares
  each uniform as `vec3` for `color` else `float`, and uploads `uniform3f` /
  `uniform1f` accordingly.
- **Demonstrations** wired to real uniforms: **Dither Matrix** is now a
  `select` (2/4/8 → `uDitherSize`); new **Palette Cycle** `toggle`
  (`uPaletteCycle`, time auto-rotates the quantize palette) and **Palette Tint**
  `color` (`uPaletteTint`, multiplies the quantize output).

Verified: `npm run build` clean, 12/12 tests pass; Preview confirms all four
widget types render, existing sliders unchanged, and select/toggle/color each
drive their uniform (coarse↔fine dither, palette rotation, green tint); error
overlay empty; console clean on a fresh server (earlier console noise was stale
HMR churn from the multi-file edit, not the final build).

---

## Phase 1 — Scanline / VHS pass

- **`src/shaders/passes/scanline.frag`** — final-stage analog-video grunge:
  periodic horizontal scanline darkening, a small per-band horizontal jitter
  that wobbles over time (VHS tracking), and film grain — all scaled by
  `uScanlineIntensity`, from subtle CRT texture to heavy degraded tape. Reuses
  `noise()`/`hash()` from `common.glsl`.
- New schema control: **Scanline / VHS**.

Verified: `npm run build` clean, 12/12 tests pass, Preview shows scanline
striping + grain + jitter when toggled on (heavy at 0.9), error overlay empty,
no console errors.

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
