# FLUX — Phase 1 Review & Handoff

Session review at the Phase 1 → Phase 2 boundary. Phase 1 (the shader &
sound-visualization core) is **complete** — all 13 tasks shipped as verified,
atomic commits. This document is the reviewed checkpoint and the starting point
for the next sprint. Per-task narrative lives in [`CHANGELOG.md`](CHANGELOG.md);
the task list and backlog live in [`ROADMAP.md`](ROADMAP.md).

---

## 1. Summary

What FLUX has after Phase 1:

- **Multi-pass FBO pipeline** — the active mode renders into an off-screen
  framebuffer; an ordered, individually-toggleable post-pass chain runs across a
  ping-pong pair (history FBO for feedback, `uScene` snapshot for multi-stage
  passes), then blits to screen.
- **6 modes** — bars, pulse, plasma, raymarched SDF, domain-warp flow field,
  Voronoi cells. All audio-reactive (bass/mid/high/level) and steerable live.
- **7 post-effects** — trails, Bayer dither, palette quantize, separable bloom,
  chromatic aberration, kaleidoscope, scanline/VHS. Each toggleable with controls.
- **Typed, context-aware controls** — slider / toggle / select / color, scoped so
  the panel shows only what's relevant to the active mode + enabled passes.

**Audit verdict: no critical bugs.** Two tech-debt items and a set of validated
upgrade paths are logged below for Phase 2.

---

## 2. Verification status

Every task passed the same gate before commit: `npm run build` (tsc +
bundle) exited 0, `npm test` was 12/12 green, a Preview MCP screenshot confirmed
the visual, the on-screen error overlay was empty, and `preview_console_logs`
(level error) was clean. Current `main` is the green tip of that chain.

---

## 3. Code audit findings

Fresh-eyes pass over the render pipeline, shaders, control plumbing, and audio.

### Correctness — clean
The pipeline ([`src/render/Renderer.ts`](../src/render/Renderer.ts),
[`src/render/Framebuffer.ts`](../src/render/Framebuffer.ts)) is sound: FBO
allocate/resize/delete lifecycle, resize handling (the `historyValid` flag
invalidates stale-size history), ping-pong read/write isolation, the multi-stage
`passInput`/`uScene` snapshot, history feedback (`uPrevFrame`), and the
`blitFramebuffer` present path are all correct. No texture is ever bound as a
sampler and a render target at the same time.

### Error handling — clean
Every failure routes through [`src/core/errors.ts`](../src/core/errors.ts): GL
allocation, shader compile/link, audio permission/device, WebGL context loss, and
global `error`/`unhandledrejection` hooks. Nothing is swallowed.

### Performance — acceptable at the DPR≤2 cap
The renderer caps device-pixel-ratio at 2. Heaviest shaders:
[`raymarch.frag:72`](../src/shaders/modes/raymarch.frag) marches up to 90 steps + a
6-tap normal (~540 `map()` calls/px worst case); `flow.frag` (nested fbm) and
`cells.frag` (25-cell Voronoi scan) have nested loops; bloom is 2-pass. All fine
at 1080p@2×; a per-mode quality/step control would help low-end GPUs later.

### Tech debt / known limitations (logged, not fixed this pass)
- **Parallel toggle mechanisms.** Post-pass on/off are ad-hoc buttons in
  [`src/main.ts:108`](../src/main.ts) calling `renderer.setPassEnabled`, while a
  typed `'toggle'` control now exists in
  [`src/ui/controls.ts`](../src/ui/controls.ts) /
  [`ControlPanel.ts`](../src/ui/ControlPanel.ts). Pass-enable state lives outside the
  control schema, so it **won't serialize** — a blocker for clean presets.
- **RGBA8 FBOs.** [`src/render/Framebuffer.ts:24`](../src/render/Framebuffer.ts)
  allocates 8-bit targets, so values clamp at 1.0: bloom and long-decay trails
  **plateau** instead of accumulating (no HDR headroom).
- **Bloom radius is resolution-dependent.** A single fixed-resolution separable
  Gaussian — narrow glow vs. modern wide bloom, and the look shifts with output
  resolution.
- **Bayer dither shows structured lines** in static frames (fine while animating).
- **Minor:** the comment at
  [`src/audio/AudioEngine.ts:63`](../src/audio/AudioEngine.ts) still references
  "file, test tone" monitoring; sources are mic-only now.

---

## 4. Technique validation (research)

We re-checked the aesthetic/technical choices against current best practice.
Verdicts: **keep** (good enough / right call) or **upgrade** (better option for
Phase 2).

| Technique | What we did | Best-practice note | Verdict |
|---|---|---|---|
| **Bloom** | Fixed-res separable Gaussian + hard threshold | Mip-chain downsample/upsample **pyramid** (Jimenez 2014) gives resolution-independent wide glow; modern engines drop the hard threshold (energy-conserving) | **Upgrade** |
| **Dither** | Procedural Bayer 2/4/8 | Bayer is cheap and **temporally stable in motion** (why engines keep it); **blue noise / interleaved gradient noise (IGN)** look better in static frames; IGN is procedural (no texture) | **Keep + add option** |
| **Beat detection** | Not yet (continuous bands only) | **Spectral flux** (half-rectified frame-to-frame spectrum diff + adaptive threshold) is the standard onset detector; plugs straight into the existing analyser | **Add (Phase 2)** |
| **HDR buffers** | RGBA8 | `RGBA16F` via `EXT_color_buffer_float` (fallback `EXT_color_buffer_half_float`) + `OES_texture_half_float_linear`; widely supported in 2025 | **Upgrade (enables better bloom/trails)** |
| **Pipeline / modes / envelope** | Ping-pong FBO chain; raymarch, domain-warp, Voronoi; asymmetric envelope follower | Standard, well-attributed (Inigo Quilez), solid | **Keep** |

Citations: Bloom — [LearnOpenGL: Physically Based Bloom](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom),
[Froyok: UE custom bloom (Jimenez 2014)](https://www.froyok.fr/blog/2021-12-ue4-custom-bloom/).
Dither — [Bart Wronski: real-world 2D quantization dithering](https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/),
[Maxime Heckel: dithering & retro shading](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/).
Beat — [Web-Onset (spectral flux, Web Audio)](https://github.com/Keavon/Web-Onset),
[audiojs/beat-detection](https://github.com/audiojs/beat-detection).
HDR — [MDN: EXT_color_buffer_float](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float),
[MDN: EXT_color_buffer_half_float](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_half_float).

---

## 5. Architecture cheat-sheet (for resuming)

Clean module seams — extend without touching plumbing:

- **New mode** = a `vec3 render(vec2 uv)` `.frag` in
  [`src/shaders/modes/`](../src/shaders/modes) + one entry in
  [`src/shaders/modes.ts`](../src/shaders/modes.ts). Header (version, builtins,
  control uniforms, `common.glsl`) is prepended by the Renderer.
- **New post-pass** = a `.frag` in [`src/shaders/passes/`](../src/shaders/passes) +
  an entry in [`src/shaders/passes.ts`](../src/shaders/passes.ts). Single-fragment
  (`fragSource`) or multi-stage (`stages: string[]`, e.g. separable bloom).
  Passes get `uSource` (prev stage), `uPrevFrame` (last frame), `uScene` (pass
  input).
- **New control** = an entry in [`src/ui/controls.ts`](../src/ui/controls.ts) with a
  `type` (`slider`/`toggle`/`select`/`color`) and optional `modes`/`pass` scope.
  Auto-wires to a widget + a uniform (`vec3` for `color`, else `float`).
- **Builtins** (`uTime`, `uResolution`, audio bands) are listed in
  [`src/render/Renderer.ts:45`](../src/render/Renderer.ts); the per-frame
  `AudioFrame` shape is in [`src/core/state.ts:2`](../src/core/state.ts).

State lives entirely in **git + `ROADMAP.md`**. Run/verify:
`npm run dev` (localhost:5173, needs HTTPS/localhost for the mic), `npm run build`,
`npm test`, and the Preview MCP for screenshots/console checks.

---

## 6. Recommended Phase 2 priorities

Refined and ordered in [`ROADMAP.md`](ROADMAP.md). In brief:

1. **Rendering quality** — HDR `RGBA16F` FBOs → mip-chain / energy-conserving
   bloom → dither options (IGN/blue-noise). The HDR upgrade unlocks the bloom one.
2. **Audio** — beat/onset detection (spectral flux) → `uBeat`/`uOnset`.
3. **State/UX** — unify pass toggles into the typed-control system (resolves the
   serialization tech debt) → presets (localStorage). Do the unification first.
4. **Input** — logo/image upload, Web MIDI.
5. **Output** — performance output (fullscreen / 2nd display / PiP), gated deploy.
