# FLUX — Reference & Research Log

Consolidated findings from every reference reviewed and every landscape sweep,
so decisions stay traceable. Per-task technique citations live in
[`CHANGELOG.md`](CHANGELOG.md) entries and commit messages; this file holds the
cross-cutting picture. Newest first.

---

## Stack posture (settled 2026-06-11)

Recurring conclusion across every reference reviewed: **FLUX's stack is
right** — vanilla TypeScript + raw WebGL2, three dev-only tools (TypeScript,
Vite, Vitest), zero runtime dependencies, ~76 kB gzipped.

- **No React.** FLUX has never used it; the UI is hand-built DOM in plain TS
  classes (`src/ui/*.ts`). None of the reviewed references use it either.
- **No Framer.** Never a dependency; the word only ever appeared in the *URL*
  of the user's old visualizer deploy, which itself turned out to be vanilla.
- **No p5.js.** Higher abstraction, lower ceiling than FLUX's own engine
  (multi-pass HDR pipeline sits below p5's abstraction level); ~1 MB of
  library to do less. Its **ecosystem** (p5 showcase, OpenProcessing) is a
  research source — ideas get ported as native GLSL (see `AGENT_LOOP.md`).
- **Three.js — the one open question**, scoped to Phase 4's true-3D mode:
  raw WebGL2 keeps zero dependencies (FLUX already owns FBO ping-pong +
  GLSL); Three.js (~150 kB min+gzip) buys camera/controls,
  `GPUComputationRenderer`, and direct portability of the reference examples.
  Decision gate: the Phase 4 spike, confirmed by the user.

## Reference sites reviewed

### waveform-visualizer-framer.vercel.app (user's earlier design, 2026-06-11)
- **Stack:** single vanilla-JS page, one WebGL canvas, ~18 kB inline script.
  No Framer, no React, despite the deploy name.
- **Adopted → Phase 3:** the floating bottom-center control pill
  (`border-radius: 999px`, `rgba(10,10,10,0.65)`, `backdrop-filter:
  blur(14px)`, auto-hide on idle), audio-file upload + drop-anywhere with
  transport/scrubber, ~5 named theme palettes on hotkeys `1`–`5`.

### melt.graphics — "SURFACE FLOW" (2026-06-11)
- **Stack:** Three.js (self-labelled "HUD·GUI THREE.JS EXPERIMENT").
- **Adopted → Phase 4:** the *visual* — flowing trails over parametric 3D
  geometry = GPGPU curl-noise particles (see technique sources below).
- **Rejected:** the HUD/terminal UI styling (corner brackets, stat readouts)
  — user prefers their own waveform-visualizer design language for Phase 3.

### fieldtone.vercel.app (2026-06-11)
- **Stack:** vanilla JS + raw WebGL (cymatics visual) + **Tone.js** for live
  generative synthesis (location/time/weather → music). No framework.
- **Takeaway:** validates the vanilla approach; generative *synthesis* is a
  different product direction — noted, not planned.

### rapidflow.shop / Sphere V3 (2026-06-11)
- **Stack:** not a web app — a Shopify (Dawn) store selling a native
  VST3/AU/AAX DAW-plugin visualizer.
- **Takeaway:** product-category reference ("visualizer on the producer's
  master bus"). FLUX's web-native equivalent of that audio path would be a
  loopback/BlackHole input source — a deliberate future option, not planned.

## Landscape: browser VJ / visualizer tools (sweep 2026-06-11)

Same WebGL foundations as FLUX throughout; useful as idea sources:

- [Hydra](https://github.com/hydra-synth/hydra) — live-coded video-synth
  feedback aesthetics.
- [cables.gl](https://cables.gl) — node-based WebGL; full VJ rigs in-browser.
- [Butterchurn](https://butterchurnviz.com/) — WebGL2 MilkDrop; the deepest
  preset catalogue of audio-reactive looks anywhere.
- Curated: [awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization),
  [VJ UNION's 50 open-source visual projects](https://vjun.io/vdmo/the-vj-creative-coders-treasure-map-50-incredible-open-source-visual-projects-on-github-581a).
- Commercial feature bar (long-term compass only): Resolume, TouchDesigner,
  Synesthesia, Magic Music Visuals — NDI/Syphon output, DMX, pixel mapping
  ([2026 comparison](https://autovj.club/en/guide/vj-software-comparison/)).

## Technique sources: GPGPU curl-noise particles (→ Phase 4)

- [Barradeau — FBO particles](https://barradeau.com/blog/?p=621) (canonical
  write-up of position/velocity ping-pong textures).
- [aadebdeb — GPGPU curl-noise particles](https://github.com/aadebdeb/study-three.js/blob/master/gpgpu-particles-with-curl-noise.html),
  [imokya/curl-noise](https://github.com/imokya/curl-noise) — runnable examples.
- [cabbibo/glsl-curl-noise](https://github.com/cabbibo/glsl-curl-noise) — the
  reusable GLSL noise-field module.
- [Codrops — audio-reactive particles in Three.js](https://tympanus.net/codrops/2023/12/19/creating-audio-reactive-visuals-with-dynamic-particles-in-three-js/),
  [Codrops — 3D audio visualizer orb](https://tympanus.net/codrops/2025/06/18/coding-a-3d-audio-visualizer-with-three-js-gsap-web-audio-api/).
- Key structural note: FLUX's post pipeline already does ping-pong float-FBO
  work, and the HDR chain (bloom/trails/tonemap) composites any mode's
  scene-FBO output for free — a 3D mode plugs into the same seams.

## Phase 2 technique citations (already in CHANGELOG per task)

HDR: MDN `EXT_color_buffer_float`, Khronos half-float + blitting specs,
Narkowicz ACES. Bloom: Jimenez SIGGRAPH 2014 (iryoku.com), LearnOpenGL
Phys.-Based Bloom, Froyok. Dither: Jimenez IGN via demofox, Bart Wronski,
Christoph Peters CC0 blue noise (momentsingraphics.de). Beat detection:
Keavon/Web-Onset, badlogic onset tutorial, audiojs/beat-detection.
