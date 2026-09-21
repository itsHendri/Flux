# FLUX

An audio-reactive WebGL2 **instrument** that runs in the browser. Not a
passive visualizer — you steer the visuals live while sound plays. Audio from
your microphone or a dropped file is analysed in real time and drives
twenty-seven modes — shader fields, live simulations, raymarched fractals,
GPU particle swarms and a growing constellation — with a control surface where
every knob maps to a shader uniform. The aesthetic is a dark "instrument panel": it should feel like a
piece of gear.

**Live:** https://itshendri.github.io/Flux/ (deploys on every push to `main`).

## Run

```bash
npm install
npm run dev      # serves on http://localhost:5173
```

Open the page, click **Enable Audio**, grant microphone access, pick an input
from the dropdown. The visuals react immediately — louder sound, more motion.
Or drop an audio file anywhere on the stage to play a track instead: the File
section gets play/pause (**Space**), a scrubber and a time readout, and the
input dropdown switches back to the mic whenever you want the room again.

```bash
npm run build    # type-check (tsc) + production bundle to dist/
npm run preview  # serve the built bundle locally
npm test         # run the unit tests (vitest)
```

> Localhost matters: `file://` blocks microphone access. Always use the dev
> server.

## What it has

- **27 modes**, in five families (the bar's picker groups them the same way):
  - *Signal* — `bars` (a real log-frequency spectrum), `waveform` (the
    time-domain trace: line, mirrored or radial), `spectro` (a spectrogram),
    `vector` (left against right: a goniometer / X-Y oscilloscope).
  - *Fields* — `flow` (domain warp), `cells` (Voronoi), `mandala` (a kaliset
    fractal folded through a kaleidoscope), `sand` (a Chladni plate driven by
    the spectrum), `fur` (a coat the bass combs), `grove` (a fractal forest
    the bands re-grow), `spacetime` (neon rays rushing past), `logo` (your
    uploaded image, audio-displaced), `limitless` (your image nested inside
    itself as an Escher spiral).
  - *Simulations* — `reaction` (Gray-Scott reaction-diffusion) and `fluid`
    (Stam's stable fluids, stirred by the music).
  - *Raymarched* — `raymarch` (iridescent metaballs), `chrome` (molten metal
    reflecting a studio), `bulb` (the Mandelbulb, re-grown by accents),
    `lattice` (the Mandelbox from outside), `gate` (falling through a
    corridor of neon gates), `oracle` (a dark chamber drawn in light at its
    edges).
  - *Particles* — `magneto` (charged particles in the spirit of the iTunes
    visualizer, each listening to its own frequency), `trails3d` (GPGPU
    curl-noise), `forge` (chrome beads that build a shape and shatter on the
    kick), `synapse` (every hit adds a star to a growing constellation),
    `anemone` (chains of rings carrying the spectrum out along each arm),
    `wisp` (one bright wanderer lighting a world of dust).
- **7 toggleable post-effects** — MilkDrop-style warp feedback, trails, a
  polar tunnel, dither (Bayer/IGN/blue-noise), mip-chain bloom, kaleidoscope
  and scanline/VHS.
- **HDR pipeline** — all off-screen targets are RGBA16F where the hardware
  allows (RGBA8 fallback), so bloom and trails accumulate real energy past
  1.0; a final present pass tonemaps (None / Reinhard / ACES).
- **Beat detection** — spectral-flux onset detectors feed `uBeat` (kick) and
  `uOnset` (any transient) pulses to every shader, beyond the smoothed
  bass/mid/high/level bands.
- **Stereo** — a per-channel analyser pair gives shaders the left and right
  waveforms (`uStereo`) and the mix's width (`uWidth`).
- **Performance governor** — when frames fall behind it steps the mode's own
  quality control down, then the render resolution, and probes back up when
  they recover; it learns a capped frame rate (a 30 Hz display, Energy Saver)
  instead of chasing it. Pinnable per machine from the Output section.
- **Performance bar** — a floating pill over the visual with the mid-set
  essentials (source, transport, theme swatches, mode cycler, fullscreen,
  PiP); it fades out when the mouse goes still. Every control on it is a
  second view of something the dock panel owns, never a second source of
  truth.
- **Themes** — five global palettes (keys `1`-`5`) that every mode bends its
  own colour toward, keeping the mode's brightness so contrast survives; a
  Tint control sets how far. **Hotkeys** — Space plays/pauses a loaded file.
- **Looks** — twenty-two built-in combinations (mode + effect chain + theme +
  controls) in the panel and on a cycling button in the bar; each lands on a
  clean slate so it always looks the same. **Set tools** — mode and look
  changes crossfade (both pictures live through the dissolve), and **auto**
  (on the bar, key `A`) changes look on every phrase boundary: tempo from the
  kick, phrases of 4–32 bars taken on a kick, early on a drop or a breakdown. **Presets** — mode + every control
  + effect state saved/recalled from localStorage. **Web MIDI** — learn-mode binds hardware knobs to any slider,
  persisted. **Output** — fullscreen and a draggable Picture-in-Picture
  window for a second display. See [`docs/DEPLOY.md`](docs/DEPLOY.md) to host
  the static build.

## How it works

- **AudioEngine** (`src/audio/`) — one `AudioContext`, a mono `AnalyserNode`
  and a per-channel pair for stereo. The FFT
  is split into bass / mid / high bands (`bands.ts`), smoothed with an
  asymmetric **fast-attack / slow-release** envelope follower
  (`EnvelopeFollower.ts`), and watched by two spectral-flux **onset
  detectors** (`OnsetDetector.ts`) for beat/onset pulses. Source-agnostic:
  the mic and a dropped file (`sources.ts`) feed the same analyser.
- **Audio texture** (`audioTexture.ts`) — alongside the smoothed scalars,
  every shader gets `uAudio`: a 512×2 texture in **Shadertoy's layout** (row 0
  the spectrum, per-bin smoothed; row 1 the waveform, triggered on a rising
  zero crossing so it holds still). `common.glsl` wraps it as `spectrum(x)`,
  `spectrumLog(x)` and `wave(x)`. Beside it, `uStereo` (2048×2 floats, left
  and right sample-aligned, `stereoAt(i)`), and two builtins: `uWidth` (stereo
  width) and `uDrive` — the music's own clock, integrated on the CPU, which
  advances at the music's pace and never runs backwards (`drive.ts`).
- **Renderer** (`src/render/Renderer.ts`) — WebGL2. The active mode renders
  into an off-screen FBO (RGBA16F where renderable — `Framebuffer.ts`), an
  ordered, toggleable post-pass chain runs across a ping-pong pair (with
  history feedback and a `uScene` snapshot for multi-stage passes), and a
  present pass tonemaps to screen. Bloom is a special-cased mip pyramid
  (`BloomPipeline.ts`). Audio bands, pulses, and control values are pushed in
  as uniforms every frame.
- **App** (`src/App.ts`) — owns the single `requestAnimationFrame` loop: ticks
  the audio, assembles an immutable `FrameState`, hands it to the renderer.
- **Shaders** (`src/shaders/`) — each field or raymarched mode is a
  `vec3 render(vec2 uv)` in its own `.frag` (registry: `modes.ts`); each
  post-effect likewise (`passes.ts`, single- or multi-stage). The Renderer
  prepends the version header + uniform block + `common.glsl` (which also
  holds the theme helpers). Editing a `.frag` hot-reloads.
- **Custom modes** (`src/render/CustomMode.ts`, `src/modes2d/`,
  `src/modes3d/`) — anything that needs state across frames or its own
  geometry: `reaction`, `fluid`, `spectro` and `vector` own buffers; `magneto`,
  `trails3d` and `forge` run GPGPU particle sims; `synapse` keeps a graph on
  the CPU (`constellation.ts`); `anemone` and `wisp` draw instanced geometry;
  `gate` integrates its own flight. They draw into the same scene FBO, so
  every effect, theme and look works on them unchanged. An optional `enter()`
  hook fires on a real switch to the mode.
- **Governor** (`src/core/governor.ts`) — `FrameGovernor` decides when to
  step (median frame time, hysteresis, probe backoff, cap learning);
  `QualityGovernor` owns what a step means per mode (`QUALITY_LEVERS`).
- **Looks** (`src/presets/looks.ts`) — the built-in combinations, applied onto
  a reset to defaults; a test checks every id and value against the schema.
- **UI** (`src/ui/`) — control panel generated from a single typed schema
  (`controls.ts`: slider/toggle/select/color, scoped per mode/pass — pass
  toggles live in the same serialisable store),
  device picker, file transport, looks and presets, MIDI learn, logo upload,
  output controls. The performance bar (`PerformanceBar.ts`) carries source,
  transport, theme swatches, the mode picker, looks and output; the dock
  panel is for deep editing and never duplicates it. Vanilla TS, no framework, so nothing churns at
  60fps. `onChange` on the control store lets one control drive others (Theme
  writes the theme colours) so hotkeys, MIDI and presets share one path;
  `hotkeys.ts` owns the keyboard.
- **State** (`src/core/state.ts`, `src/presets/`) — `FrameState.controls` is
  the complete serialisable snapshot; presets round-trip it by stable ids.
- **Errors** (`src/core/errors.ts`) — every failure surfaces on-screen; nothing
  fails silently.

## Project direction

This project is built **incrementally, one verified task at a time** (one atomic
commit each), and can run under an autonomous agent loop that builds
continuously through a phase before pausing for review.

- **`docs/ROADMAP.md`** — the source of truth for what's done and what's next.
- **`docs/AGENT_LOOP.md`** — the protocol an autonomous agent follows each
  iteration (research → implement → verify → commit → log).
- **`docs/CHANGELOG.md`** — plain-English log of every completed task.
- **`docs/REFERENCES.md`** — every research sweep (the iTunes/MilkDrop
  lineage, structural effects, photism.app), with sources, and the settled
  stack posture (no React/Framer/p5; raw WebGL2 chosen over Three.js at the
  Phase 4 gate).
- **`docs/PHASE-1-REVIEW.md`** — the Phase 1 audit/handoff; the Phase 2
  review lives in the changelog.
- **`docs/DEPLOY.md`** — hosting the static build (gated: no third-party
  deploys without approval).

## Conventions

- One task per change; commit per verified task. Never pushed without the
  user's say-so — pushing to `main` deploys the live site.
- Keep all failures visible via the on-screen error overlay.
- Clean module seams — shaders are iterated in isolation.
- Visual/aesthetic work is research-first: study open-source and reference
  shaders (Shadertoy, Inigo Quilez, etc.) before implementing, and cite sources.

## License

[MIT](LICENSE).
