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

```bash
npm run build    # type-check (tsc) + production bundle to dist/
npm run preview  # serve the built bundle locally
npm test         # run the unit tests (vitest)
```

> Localhost matters: `file://` blocks microphone access. Always use the dev
> server.

## How it works

- **AudioEngine** (`src/audio/`) — one `AudioContext` + `AnalyserNode`. The FFT
  is split into bass / mid / high bands (`bands.ts`) and smoothed with an
  asymmetric **fast-attack / slow-release** envelope follower
  (`EnvelopeFollower.ts`) — this asymmetry is what makes motion feel musical.
  Source-agnostic: any device from the picker feeds the same analyser.
- **Renderer** (`src/render/Renderer.ts`) — WebGL2, a single fullscreen
  triangle; the active mode's fragment shader does all the visuals. Audio bands
  and control values are pushed in as uniforms every frame.
- **App** (`src/App.ts`) — owns the single `requestAnimationFrame` loop: ticks
  the audio, assembles an immutable `FrameState`, hands it to the renderer.
- **Shaders** (`src/shaders/`) — each mode is a `vec3 render(vec2 uv)` function
  in its own `.frag` file. `common.glsl` holds shared helpers; the Renderer
  prepends the version header + uniform block + common code before each mode.
  Editing a `.frag` hot-reloads.
- **UI** (`src/ui/`) — control panel (sliders generated from a single schema in
  `controls.ts`), level meters, mode switcher, device picker. Vanilla TS, no
  framework, so nothing churns at 60fps.
- **Errors** (`src/core/errors.ts`) — every failure surfaces on-screen; nothing
  fails silently.

## Project direction

This project is built **incrementally, one verified task at a time**, and can
run under an autonomous agent loop.

- **`docs/ROADMAP.md`** — the source of truth for what's done and what's next.
- **`docs/AGENT_LOOP.md`** — the protocol an autonomous agent follows each
  iteration (research → implement → verify → commit → log).
- **`docs/CHANGELOG.md`** — plain-English log of every completed task.

## Conventions

- One task per change; commit per verified task (never pushed automatically).
- Keep all failures visible via the on-screen error overlay.
- Clean module seams — shaders are iterated in isolation.
- Visual/aesthetic work is research-first: study open-source and reference
  shaders (Shadertoy, Inigo Quilez, etc.) before implementing, and cite sources.
