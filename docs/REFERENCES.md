# FLUX — Reference & Research Log

Consolidated findings from every reference reviewed and every landscape sweep,
so decisions stay traceable. Per-task technique citations live in
[`CHANGELOG.md`](CHANGELOG.md) entries and commit messages; this file holds the
cross-cutting picture. Newest first.

---

## photism.app (sweep 2026-09-18)

The user pointed at [photism.app](https://photism.app/), a commercial
audio-reactive visualizer (VST3/AU/M4L/browser), for its styles. It's closed
software, so nothing here is borrowed from it — what it gives is a **map of
which looks are worth having**, in twenty named scenes with one-line
descriptions. The techniques behind the two we took are public and long
documented, and FLUX implements them from those sources.

**Taken:**

- **mandala** — "a kali fractal folded through a kaleidoscope, edge to edge.
  The pattern opens and closes with the kick and rotates with your mids." The
  kaliset (Kali, fractalforums) is `p = abs(p)/dot(p,p) - c` iterated: fold,
  invert, offset. Sources: [Basic KaliSet](https://www.shadertoy.com/view/MsBGDK),
  [Softology on kalisets](https://softologyblog.wordpress.com/2011/05/04/kalisets-and-hybrid-ducks/).
  → FLUX's `mandala` mode.
- **sand** — "a Chladni plate: sand gathering on the nodal lines of a
  vibrating surface. The plate modes closest to the loudest frequencies in
  your music carry the figure." The figure is the zero set of
  `cos(n·pi·x)cos(m·pi·y) − cos(m·pi·x)cos(n·pi·y)`
  ([Paul Bourke](https://paulbourke.net/geometry/chladni/),
  [barbegenerativediary tutorial](https://barbegenerativediary.com/en/tutorials/how-to-create-a-chladni-figure-with-processing/)).
  → FLUX's `sand` mode.
- **morphogen** — "an inkblot grown by a reaction-diffusion sim." FLUX already
  had the simulation; what it didn't have was the **mirror**. Symmetry is the
  whole difference between wallpaper and an inkblot. → `reaction`'s Symmetry
  control.

**Noted, not built.** The rest of their catalogue, as a list of directions
worth considering later: ink (marbled fluid), signal (analyser + scope +
spectrogram + goniometer — a spectrogram would need a scrolling history
texture, which FLUX has no equivalent of yet), relic/idol/citadel (Mandelbulb
and Mandelbox fly-throughs), ingot and forge (molten chrome), anemone (chains
of rings), grove (fractal forest), wisp (dust), spacetime (neon rays), pelt
(brushable fur), fluid (Navier-Stokes, kicks stir the ink), synapse (a node
added per hit), gate (falling through a corridor), oracle (edge-lit dark
room), limitless (your own image warped — FLUX's `logo` mode is the seed of
this one).

Worth noticing about their product framing, separate from the visuals: every
scene ships with **presets that are whole looks** — "palette, motion, and post
baked in" — which is the same conclusion FLUX reached with its built-in looks.

---

## Structural effects (sweep 2026-09-16, round two)

Prompted by the user's note that several effects "affect the color rather than
the visual". The question was what visualizers in this lineage did to the
*geometry* of the picture.

- **iTunes 10's Magnetosphere** had three named components: **cores** (the
  moving spheres), **rays** flowing out of them, and **nebula clouds** filling
  the screen, toggled with N and described as iridescent
  ([TidBITS](https://tidbits.com/2015/06/12/funbits-be-a-vj-with-the-itunes-visualizer/),
  [Macworld](https://www.macworld.com/article/192667/itunes8visualizer.html)).
  The iridescence is what `raymarch` now borrows, and `magneto` now draws all
  three (cores, rays, nebula) as a background pass.
- **MilkDrop's video echo** — a second graphics layer controlled by
  `echo_zoom` (size), `echo_alpha` (0 off / 0.5 half / 1 opaque) and
  `echo_orient` (four orientations)
  ([Geiss's authoring guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html)).
  → the `echo` pass.
- **The 2D tunnel** — polar coordinates with depth as 1/radius, the demoscene
  staple ([Shadertoy "Tunnel Effect"](https://www.shadertoy.com/view/4djBRm),
  [GTC 14 basic tunnel](https://www.shadertoy.com/view/4lj3WD)). → `tunnel`.
- **The shockwave filter** — a radial displacement ring expanding from a
  point ([Geeks3D 2D shockwave](https://www.geeks3d.com/20091116/shader-library-2d-shockwave-post-processing-filter-glsl/)).
  FLUX's version needs no timer: `uBeat` already decays exponentially from a
  kick, so `1 - uBeat` is an ease-out radius. → `shock`.
- **Retired:** `quantize` (maps luminance onto its own cosine palette, so it
  also overrode the theme) and `chroma` (a constant RGB fringe; the fringe now
  lives on the shock front, where something is actually happening).

---

## The iTunes-visualizer lineage (sweep 2026-09-16)

Prompted by the user: "have a look at iTunes and the iTunes visualizers, see
if there's any open source clones". Four generations, what each one actually
did, and what is legally and practically borrowable.

### The lineage

- **The Classic Visualizer (2001–)** — iTunes 1.0 was SoundJam MP, bought by
  Apple in 2000; the visualizer came with it (Jeff Robbin, Bill Kincaid, Dave
  Heller), itself in the Winamp tradition. The look: the **time-domain
  waveform** drawn as glowing lines, mirrored into symmetric patterns over a
  feedback field. Closed source.
- **G-Force / WhiteCap / Jelly (SoundSpectrum)** — the plug-ins people
  installed on top of iTunes. Closed source and, unusually, *undocumented*:
  a deliberate sweep found no public description of the internals, only
  marketing pages. Nothing to copy, but the shape of the thing is legible
  from the output — waveform geometry, screen-space feedback transforms, and
  a scriptable preset format.
- **Magnetosphere → the iTunes 8 Visualizer (2007–08)** — Robert Hodgin's
  Processing sketch, ported to C++ by Andrew Bell at The Barbarian Group and
  adopted by Apple as the default. **This one is documented by its author**
  (see below), and it's the closest to what FLUX can already do.
- **MilkDrop (Winamp, Ryan Geiss)** — not iTunes, but the parent of the whole
  genre, and the only one with a first-class open-source reimplementation.

### What's actually open source

| Project | Licence | Use to us |
| --- | --- | --- |
| [butterchurn](https://github.com/jberg/butterchurn) | **MIT** | MilkDrop 2 in WebGL2, driven from a Web Audio node. Same stack as FLUX, permissive licence — the one codebase we can read *and* borrow from with attribution. |
| [projectM](https://github.com/projectM-visualizer/projectm) | LGPL | The C++ MilkDrop reimplementation. **Study only** — LGPL would infect FLUX's MIT posture if code were lifted. Techniques are fine; source is not. |
| [Fountain Music](https://github.com/BinaryMinded/Fountain-Music) | BSD-3 | Brian Moore's iTunes particle-fountain visualizer. Obsolete Carbon/OpenGL, but a readable reference for audio-driven particle emission. |
| [VizKit](https://www.imagomat.de/vizkit/) | open | A samplework for *writing* iTunes visualizer plug-ins — the host-integration plumbing, not the visuals. Not useful to a browser app. |
| MilkDrop presets | mixed/CC | Thousands of them, and they are readable equation text. A rich idea mine even without running them. |

**No open-source clone of Magnetosphere or G-Force exists.** The honest
answer to "are there clones we can implement?" is: MilkDrop yes (butterchurn,
MIT), the iTunes ones no — but both are documented well enough to rebuild the
*techniques* natively, which is what FLUX does anyway.

### The three techniques worth taking

**1. The audio texture — the foundation FLUX is missing.**
Shadertoy's convention is a **512×2 single-channel texture: row 0 = FFT
spectrum, row 1 = the time-domain waveform**, each byte-normalised to 0..1
([Shadertoy "Input - Sound"](https://www.shadertoy.com/view/Xds3Rr),
[soulthreads' notes on the exact normalisation](https://gist.github.com/soulthreads/2efe50da4be1fb5f7ab60ff14ca434b8)).

FLUX today hands its shaders **six scalars** (bass/mid/high/level/beat/onset)
and nothing else. That is why `bars` fakes its spectrum — `barHeight()`
spreads three band values across the columns with Gaussian weights and adds
noise "so neighbours dance independently". It looks alive, but it isn't
reading the music; it's reading three numbers. Every visualizer in this
lineage draws the **waveform**, and FLUX cannot draw one at all.

Adopting the Shadertoy layout verbatim has a second payoff: **any
audio-reactive Shadertoy shader becomes portable to FLUX** with a uniform
rename, which turns the largest library of reference material in this space
into something we can actually use.

**2. MilkDrop's warp feedback — the signature move of the genre.**
Each frame samples the *previous* frame through a displaced UV field. Geiss's
[preset authoring guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html)
gives the exact vocabulary: `zoom` (1.0 = still, 0.9 out, 1.1 in), `rot`,
`warp` (0 none / 1 normal / 2 major), `dx`/`dy` translation, `sx`/`sy`
stretch, `cx`/`cy` as the centre of rotation and stretch, and `decay` (~0.98
recommended; 0.9 is a strong fade). MilkDrop interpolates these across a
coarse vertex mesh; in a fragment shader we can evaluate them **per pixel**,
which is strictly better and costs nothing extra.

FLUX already has the hard part — a `history` FBO bound as `uPrevFrame` — and
uses it only for a straight decay trail. Warp feedback is the same buffer
with a real transform in front of it, and it composes with kaleidoscope
(the user's favourite) into the tunnels and spirals this genre is known for.

**3. Magnetosphere's charged particles — a second use for the GPGPU rig.**
Hodgin describes it as "a physics system which plays opposing forces against
each other. Some elements in the scene have an attractive force, others have
a repulsive force" — each particle carries a **charge**, and crucially each
particle is "assigned a specific frequency to pay attention to", so the FFT
drives per-particle charge and force strength rather than one global level.
Rendering is additive blending, chosen partly to sidestep depth sorting
([roberthodgin.com/project/magnetosphere](https://roberthodgin.com/project/magnetosphere)).

FLUX's `trails3d` already runs position/velocity ping-pong over 16k–262k
particles with additive HDR points. Swapping curl-noise advection for
charge-based attraction/repulsion — with the per-particle frequency lookup
that the audio texture above makes possible — is a new mode on an existing
rig, not a new engine.

### Also noted

- **Reaction-diffusion (Gray-Scott)** is the strongest candidate for a mode
  that is *structurally* unlike the fbm-noise fields FLUX already has: it's
  a genuine simulation on a ping-pong buffer, all organic growth and
  coral/fingerprint structure. References: [Karl Sims' tutorial](https://www.karlsims.com/rd.html),
  [Munafo's parameter atlas](http://www.mrob.com/pub/comp/xmorphia/index.html),
  [pmneila's WebGL implementation](https://pmneila.github.io/jsexp/grayscott/).
  Feed rate / kill rate are two knobs that map naturally onto audio bands.

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
