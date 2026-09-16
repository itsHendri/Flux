# FLUX

An audio-reactive WebGL2 shader **instrument** that runs in the browser. Not a
passive visualizer — you steer the visuals live while sound plays. Audio from
your microphone is analysed in real time and drives a full-screen fragment
shader, with a control surface where every knob maps to a shader uniform. The
aesthetic is a dark "instrument panel": it should feel like a piece of gear.

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

## What it has (Phase 2)

- **7 modes** — bars, pulse, plasma, raymarched SDF, domain-warp flow, Voronoi
  cells, and an uploaded-logo mode (image rides a bass ripple, pops on the
  beat). **7 toggleable post-effects** — feedback trails, dither
  (Bayer/IGN/blue-noise), palette quantize, mip-chain bloom, chromatic
  aberration, kaleidoscope, scanline/VHS.
- **HDR pipeline** — all off-screen targets are RGBA16F where the hardware
  allows (RGBA8 fallback), so bloom and trails accumulate real energy past
  1.0; a final present pass tonemaps (None / Reinhard / ACES).
- **Beat detection** — spectral-flux onset detectors feed `uBeat` (kick) and
  `uOnset` (any transient) pulses to every shader, beyond the smoothed
  bass/mid/high/level bands.
- **Performance bar** — a floating pill over the visual with the mid-set
  essentials (source, transport, theme swatches, mode cycler, fullscreen,
  PiP); it fades out when the mouse goes still. Every control on it is a
  second view of something the dock panel owns, never a second source of
  truth.
- **Themes** — five global palettes (keys `1`-`5`) that every mode bends its
  own colour toward, keeping the mode's brightness so contrast survives; a
  Tint control sets how far. **Hotkeys** — Space plays/pauses a loaded file.
- **Presets** — mode + every control + effect state saved/recalled from
  localStorage. **Web MIDI** — learn-mode binds hardware knobs to any slider,
  persisted. **Output** — fullscreen and a draggable Picture-in-Picture
  window for a second display. See [`docs/DEPLOY.md`](docs/DEPLOY.md) to host
  the static build.

## How it works

- **AudioEngine** (`src/audio/`) — one `AudioContext` + `AnalyserNode`. The FFT
  is split into bass / mid / high bands (`bands.ts`), smoothed with an
  asymmetric **fast-attack / slow-release** envelope follower
  (`EnvelopeFollower.ts`), and watched by two spectral-flux **onset
  detectors** (`OnsetDetector.ts`) for beat/onset pulses. Source-agnostic:
  any device from the picker feeds the same analyser.
- **Renderer** (`src/render/Renderer.ts`) — WebGL2. The active mode renders
  into an off-screen FBO (RGBA16F where renderable — `Framebuffer.ts`), an
  ordered, toggleable post-pass chain runs across a ping-pong pair (with
  history feedback and a `uScene` snapshot for multi-stage passes), and a
  present pass tonemaps to screen. Bloom is a special-cased mip pyramid
  (`BloomPipeline.ts`). Audio bands, pulses, and control values are pushed in
  as uniforms every frame.
- **App** (`src/App.ts`) — owns the single `requestAnimationFrame` loop: ticks
  the audio, assembles an immutable `FrameState`, hands it to the renderer.
- **Shaders** (`src/shaders/`) — each mode is a `vec3 render(vec2 uv)` in its
  own `.frag` (registry: `modes.ts`); each post-effect likewise
  (`passes.ts`, single- or multi-stage). The Renderer prepends the version
  header + uniform block + `common.glsl`. Editing a `.frag` hot-reloads.
- **UI** (`src/ui/`) — control panel generated from a single typed schema
  (`controls.ts`: slider/toggle/select/color, scoped per mode/pass — pass
  toggles live in the same serialisable store), level meters, mode switcher,
  device picker, file transport, theme selector, presets, MIDI learn, logo
  upload, output controls. Vanilla TS, no framework, so nothing churns at
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
- **`docs/REFERENCES.md`** — consolidated reference reviews, landscape
  research, and the settled stack posture (no React/Framer/p5; Three.js is a
  Phase 4 decision gate).
- **`docs/PHASE-1-REVIEW.md`** — the Phase 1 audit/handoff; the Phase 2
  review lives in the changelog.
- **`docs/DEPLOY.md`** — hosting the static build (gated: no third-party
  deploys without approval).

## Conventions

- One task per change; commit per verified task (never pushed automatically).
- Keep all failures visible via the on-screen error overlay.
- Clean module seams — shaders are iterated in isolation.
- Visual/aesthetic work is research-first: study open-source and reference
  shaders (Shadertoy, Inigo Quilez, etc.) before implementing, and cite sources.

## License

[MIT](LICENSE).
