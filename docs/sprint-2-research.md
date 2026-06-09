# FLUX — Sprint 2 Research & Handoff

Research notes gathered at the end of the Sprint 0/1 session, to brief a fresh
session before starting Sprint 2.

## Where the project stands

- **Sprint 0 — done.** Vite + TS scaffold, `AudioEngine` (fast-attack/slow-release
  envelope follower), WebGL2 `Renderer` (fullscreen triangle), 3 shader modes,
  on-screen error overlay, always-on render loop.
- **Sprint 1 — done.** Universal device picker (`enumerateDevices`),
  permission-before-enumerate, `default`/`communications` alias dedup, live
  `devicechange` refresh.
- **UX state.** Transparent dockable panel; single "Enable Audio" gesture; no
  play/pause (visuals always run); microphone input via a device dropdown.
  Test tone and file upload were removed by user request.
- **Input scope decision.** FLUX is **mic-only**. System-audio loopback
  (BlackHole etc.) was trialled and dropped: it requires a per-machine virtual
  audio device, so it can never be click-and-go for a hosted product, and it
  interfered with other audio apps on the machine. The mic is the universal,
  zero-install input. If a no-install "react to a browser tab" path is ever
  wanted, `getDisplayMedia()` tab-audio capture is the route — but it is
  explicitly out of scope for now.

Module seams to build on: `src/render/Renderer.ts` (compiles modes, owns the
GL context), `src/shaders/modes/*.frag` (each mode = a `vec3 render(vec2 uv)`
function), `src/shaders/common.glsl` (shared helpers), `src/App.ts` (owns the
rAF loop and builds `FrameState`).

## Sprint 2 goal (from the original plan)

1. **Stronger shaders** — domain-warped noise, raymarched SDFs.
2. **Multi-pass post-effect pipeline** — render the scene to a framebuffer, then
   chain toggleable post passes.
3. **Ordered Bayer-matrix dither pass** — NOT error-diffusion (that's sequential
   and can't run in a parallel fragment shader).
4. **Palette quantization** — quantize to N colours, optionally band-driven.

## What these techniques actually are

- **Domain warping** — distort the *input coordinates* of a noise function
  before sampling it (`f(p + warp·g(p))` instead of `f(p)`). Turns simple noise
  into organic, flowing structure. Already used lightly in `plasma.frag`.
- **Raymarched SDFs** — a Signed Distance Function returns the distance from any
  point to the nearest surface. Marching a ray forward by that distance renders
  true 3D shapes inside a fragment shader, no geometry. Standard demoscene /
  Shadertoy technique.
- **Multi-pass pipeline** — instead of drawing straight to screen, draw to an
  off-screen texture (framebuffer object / FBO), then run further shader passes
  that read that texture. Each pass is toggleable and ordered. This also unlocks
  a **feedback buffer** (sample the *previous* frame → trails, echo, smear) via
  ping-pong FBOs.
- **Ordered (Bayer) dithering** — reduce colour banding with a fixed threshold
  matrix tiled across the screen. Compare each pixel's luminance to its matrix
  cell. Parallel-friendly (every pixel independent), unlike Floyd–Steinberg.
- **Palette quantization** — snap colours to a small fixed set (N colours). With
  dithering, gives the crisp retro/printed look. Can be band-driven (e.g. bass
  shifts the palette).

## Reference shaders & open-source projects

**Browse / inspiration**
- [Shadertoy](https://www.shadertoy.com/) — the canonical fragment-shader gallery; search "audio", "domain warp", "raymarch". (Note: 2026 API changes mean external tools can't bulk-access it — browse manually.)
- [Ordered Dithering (Bayer) on Shadertoy](https://www.shadertoy.com/view/7sfXDn) — live, editable dither example.

**Audio-reactive frameworks (closest analogs to FLUX)**
- [Audio Shader Studio](https://github.com/sandner-art/Audio-Shader-Studio) — MIT-licensed, modern; live GLSL editor, audio uniform library, beat-detection uniforms. The single most relevant reference for FLUX's architecture.
- [audiojs/audio-shader](https://github.com/audiojs/audio-shader) — Shadertoy-compatible audio shader runner; copy-paste shaders run locally.
- [awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization) — curated list (Clubber.js for music-theory-aware reactivity, etc.).

**The gold standard for audio visuals (Milkdrop lineage)**
- [Butterchurn](https://github.com/jberg/butterchurn) — WebGL Milkdrop in the browser; preset-based, evolving audio-reactive visuals. [Live demo](https://butterchurnviz.com/).
- [projectM](https://github.com/projectM-visualizer/projectm) — cross-platform Milkdrop reimplementation; reference for FFT + beat detection + preset rendering.
- Hydra — browser live-coding visual synth, popular with VJs (worth a look for the live-steering interaction model).

**Domain warping / raymarching / SDF theory**
- [Inigo Quilez articles index](https://iquilezles.org/articles/) — definitive: Domain warping (`/articles/warp/`), Raymarching SDFs, FBM, noise derivatives, smooth-min, domain repetition, soft shadows.
- [Painting with Math: A Gentle Study of Raymarching](https://blog.maximeheckel.com/posts/painting-with-math-a-gentle-study-of-raymarching/) — approachable raymarching primer.

**Dithering implementation**
- [Building a Real-Time Dithering Shader — Codrops](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) — modern WebGL walkthrough; `getValue(brightness, position)` + 4×4 Bayer + optional pixelation.
- [The Art of Dithering and Retro Shading for the Web — Maxime Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/) — thorough; explains why error-diffusion can't be a fragment shader.
- [hughsk/glsl-dither](https://github.com/hughsk/glsl-dither) — MIT module, 2×2/4×4/8×8 Bayer, drop-in `dither(gl_FragCoord.xy, color)`.
- [Martins Upitis — GLSL 8×8 Bayer dithering](http://devlog-martinsh.blogspot.com/2011/03/glsl-8x8-bayer-matrix-dithering.html) — classic copy-ready raw GLSL.
- [libretro bayer-matrix-dithering.glsl](https://github.com/libretro/glsl-shaders/blob/master/dithering/shaders/bayer-matrix-dithering.glsl) — ready-to-use.

## Image / logo upload — feasibility

**Verdict: feasible and a great fit for the home-DJ use case.** A DJ uploads
their logo (SVG or PNG); the shader treats it as an audio-reactive texture.

Pipeline:
1. SVG can't be read by a shader directly — rasterise it first. Set the SVG (or
   its data URL) as the `src` of an `Image`, wait for `onload`.
2. On load, upload it into a WebGL texture with `texImage2D`.
3. Expose it to shaders as a `uniform sampler2D uLogo` (+ a `uHasLogo` flag).
4. Shaders manipulate it: audio-reactive UV displacement (offset the texture
   lookup by warped noise scaled by bass), use it as a mask/stencil for another
   effect, ripple it on beats, treat its luminance as an SDF, etc.

Caveats: non-power-of-2 textures need `NEAREST`/`LINEAR` filtering and no
mipmaps in WebGL; upload the texture **once**, then animate via uniforms (don't
re-upload per frame). For crisp text, drawing to a `<canvas>` at display
resolution is better than a tiny rasterised SVG.

Recommended scoping: this is naturally its own feature. Either a dedicated
"logo" shader mode in Sprint 2, or a Sprint 3 item (alongside presets). The
texture-input plumbing in `Renderer` is small; the creative shader work is the
bulk.

## Other things we can do with shaders (idea backlog)

- **Feedback / trails** — falls out of the multi-pass pipeline for free
  (ping-pong FBO). Strong, cheap visual payoff.
- **Beat-triggered events** — flashes, palette flips, scene cuts on onset
  (overlaps Sprint 3 spectral-flux work).
- **Kaleidoscope / mirror symmetry** — a post pass; very effective for music.
- **Bloom / glow** — bright-pass + blur passes in the pipeline.
- **Chromatic aberration, scanlines, VHS** — cheap post passes, toggleable.
- **Palette / theme presets** — named colour sets the user picks (ties into
  palette quantization + Sprint 3 preset save/load).
- **Logo as mask or SDF** — once texture input exists (see above).
- **More generative modes** — raymarched tunnels, metaballs, flow fields.

## Open decisions for the next session

1. Which 2–3 reference shaders to adapt as the "stronger" Sprint 2 modes
   (raymarched SDF? domain-warp flow field? metaballs?).
2. Pass order for the post pipeline (suggestion: scene → feedback → bloom →
   dither → palette quantize → screen).
3. Logo upload — include in Sprint 2 or defer to Sprint 3?
4. Should post-passes be individually toggleable from the panel now, or
   hard-wired until later?

## Handoff: kickoff prompt for the fresh session

> Continue the FLUX project at `/Users/hendri/Flux`. Sprints 0 and 1 are
> complete and verified — read `docs/sprint-2-research.md` for full context.
> Start **Sprint 2**: real visuals + the multi-pass dither pipeline.
>
> Scope: (1) 2–3 stronger shader modes (domain-warped noise / raymarched SDFs);
> (2) a multi-pass post-effect pipeline — render the scene to a framebuffer,
> then chain toggleable passes; (3) an ordered Bayer-matrix dither pass;
> (4) palette quantization (N colours, optionally band-driven).
>
> Working principles (unchanged): one sprint at a time, confirm before moving
> on; clean module seams (I iterate shaders myself); keep all failures visible
> via the on-screen error overlay; don't batch sprints.
>
> Start by proposing how the multi-pass pipeline slots into the existing
> `Renderer` before writing code.
