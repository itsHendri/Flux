# FLUX Changelog

Plain-English log of every completed task, newest first. Each loop iteration
adds one entry (see `AGENT_LOOP.md`).

---

## PHASE 5 COMPLETE — review

Seven verified commits, from a research sweep of the iTunes visualizers and
their open-source clones to six things you can actually switch between.

1. **The audio texture** — shaders finally see the spectrum and the waveform,
   in Shadertoy's layout, which also makes that whole library portable here.
2. **Honest bars** — it read three numbers and faked the rest; now it reads
   the FFT on a log axis.
3. **Warp feedback** — MilkDrop's signature, on a history buffer FLUX had been
   using for a flat decay.
4. **waveform** replaces `pulse` — the classic iTunes read, triggered like a
   scope so it holds still.
5. **reaction** replaces `plasma` — a Gray-Scott simulation instead of a
   second noise field.
6. **magneto** — the iTunes 8 physics: charged particles, each listening to
   its own frequency.
7. **Six built-in looks** — the combinations question, answered in the
   product.

FLUX is now 9 modes, 8 effects, 5 themes and 6 looks, still vanilla TS and raw
WebGL2 with zero runtime dependencies (~44 kB gzipped).

**For the user, live in Chrome with a real track:** walk the `looks` button on
the bar, then `1`–`5` over whichever one lands. Two things the embedded pane
can't judge and you can: **comet** (and `trails3d` generally) is sparse and
dim here because the pane only pumps frames during capture, so trails and
bloom never accumulate — it should be much brighter live, and its Gain is the
knob if not. And **magneto**'s Charge/Momentum pair is the taste control of the
whole set: higher Charge throws more dramatic streams, and the point where it
stops being a swarm and starts being a starfield is a judgement call, not a
number. Still outstanding from earlier phases: the Traktor S2 MIDI check.

---

## Phase 5 — Built-in looks

The user's own open question — "I still need to play around and look at a few
combos" — answered in the product rather than left as homework. Nine modes
and eight effects is more combinations than anyone wants to audition mid-set,
so six are named and shipped: **cathedral** (flow pulled through itself and
mirrored), **coral** (the reaction in firelight), **scope** (the mirrored
waveform on a cold ribbon), **supernova** (magneto with the glow the original
had), **tape** (the spectrum through a dithered, scanlined transfer) and
**comet** (the curl-noise swarm mirrored into acid).

- **A look is applied onto a clean slate.** Every control resets to its
  default first, so recalling one always lands in the same place — a look that
  inherited whatever effects were already on wouldn't be a look, it would be a
  suggestion. Verified by turning on four unrelated effects and recalling: the
  chain comes back to exactly the look's own.
- **In the panel and on the bar.** The Looks row sits above your own presets;
  the bar gets a single button that cycles them, because mid-set the question
  is "give me a different look", not "which of six".
- **A test guards the ids.** `resolvePreset` silently drops ids it doesn't
  recognise, so a typo wouldn't throw — the look would just quietly come out
  wrong. The suite now checks every id exists, every value is inside its
  control's range or option set, every mode name is real, and every look turns
  on at least one effect. It caught four wrong ids on the first run
  (`chromaSplit`, `ditherMatrix`, `ditherNoise`, `scanline`).

Tuning notes, since half the work was taste: `tape` dropped **quantize**,
which maps luminance onto its own cosine palette and therefore overrides the
theme — it can't be monochrome, whatever Mono says. Three looks needed an
explicit tonemap (ACES for `cathedral` and `coral`, Reinhard for `scope`):
with tonemap None, bloom on a bright full-screen mode clips straight to
white. And `tape` runs at Gain 0.3 because on a loud track every column pins
to full height at the usual gain, and a wall of full-height bars is not a
spectrum.

Verified: build clean, 89/89 tests. In the Preview browser all six load and
render distinctly against a played track, the bar's button cycles them and
names the active one, recalling a look after a pile of unrelated effects is
deterministic, and user presets still save and recall alongside. All 9 modes
and 8 passes still run together; overlay empty, no console errors.

---

## Phase 5 — magneto: the iTunes 8 visualizer's physics

The one this whole research round was pointed at. Robert Hodgin's
Magnetosphere — Apple's default visualizer from iTunes 8 — has no open-source
clone, but the author describes the mechanism plainly: "a physics system which
plays opposing forces against each other. Some elements in the scene have an
attractive force, others have a repulsive force, and over time these elements
create dynamic compositions." FLUX already owned the rig; what it needed was
the physics.

- **Every particle carries a charge and a frequency.** Half the swarm is
  positive, half negative, and each particle keeps a fixed slice of the
  spectrum for life. Four poles orbit the scene; whether a pole pulls or
  throws a given particle is the product of their charges, so the same pole
  grabs half the swarm and flings the other half. Nothing choreographs the
  shapes — they're what the opposition does.
- **The audio enters per particle, not globally.** This is Hodgin's actual
  trick ("assign each particle a specific frequency to pay attention to"), and
  it's only possible now that shaders can read the spectrum: a particle's
  force, size and flare all scale with what *its* band is doing this instant.
  A kick flips one pole's charge — one, not all, because flipping everything
  just mirrors the scene while flipping one re-sorts which half of the swarm
  each pole owns.
- **Position and velocity in separate ping-pong pairs**, stepped by two passes
  rather than one MRT pass: simpler, and the cost is one extra fullscreen draw
  over a small texture. Additive points, **no depth buffer at all** — the same
  reason Hodgin moved the original to additive blending, since light sums in
  any order and there's nothing to sort.
- **The tuning was the work.** The first balance boiled the swarm away into a
  uniform starfield within seconds: a true 1/r² goes to infinity at the pole,
  one close pass flings a particle clear of the scene, and the respawn brings
  it back somewhere random. Fixed by softening the force a lot (r² + 0.35),
  making the containing spring stiff enough to beat a pole at range, and
  clamping speed to something the spring can answer for. The swarm is now a
  *body* the poles deform rather than four independent clouds.

Verified: build clean, 80/80 tests. In the Preview browser, with a kick-and-air
track playing, the shell forms and the poles gather particles into bright
streaming filaments that change between frames; with bloom + trails — how the
original was meant to be seen — it reads as the luminous comet-arc swarm it's
modelled on. All 9 modes and 8 passes run together, overlay empty, no console
errors.

Source: [roberthodgin.com/project/magnetosphere](https://roberthodgin.com/project/magnetosphere)
(see REFERENCES.md).

---

## Phase 5 — plasma becomes reaction: a simulation, not a field

`plasma` and `flow` were both domain-warped fbm, which is why the user saw
them as the same thing. `reaction` takes the slot with something structurally
different: **Gray-Scott reaction-diffusion**, two chemicals on a ping-pong
buffer where what you see now is the consequence of what was there a second
ago. Nothing draws the coral, worms or dividing cells — they're what the
equations do at a given feed/kill pair.

- **A CustomMode, not a fragment mode**, because a fragment mode can't hold
  state. It owns its buffers and steps them 12 times a frame by default: one
  Euler step barely moves, and the pattern has to grow at a watchable rate.
  `Growth` is that iteration count — this mode's perf story, the way
  `Particles` is trails3d's.
- **Feed and Kill are the controls**, ranged to the *usable* window rather
  than the mathematical one: the living region of this model is narrow, and
  outside it the pattern either dies out or floods the frame. Audio nudges
  both, but only slightly, for the same reason.
- **Kicks spray fresh B**, latched on the rising edge so one kick means one
  spray rather than one per sim step — the pattern keeps being reborn instead
  of settling into a static maze.
- **Re-entering the mode reseeds.** The growth is the interesting part and a
  settled maze is the dull end of it — and at some feed/kill pairs the
  reaction dies out completely, where resuming would hand you a black screen
  with no way to restart it.
- **Lit by its own gradient**: a central-difference normal off the B field
  gives the raised, coral-like read instead of a flat stain, and the rims take
  a second stop of the theme ramp.
- The float-texture trap from trails3d applies here too and is handled the
  same way: data textures are explicitly NEAREST, since a LINEAR-filtered
  float texture is sampling-incomplete and every fetch silently returns zero.

Verified: build clean, 80/80 tests. In the Preview browser the simulation
does what the model says it should: seed blobs expand into rings, rings
divide, and by ~4 s the frame is the classic labyrinth; moving Feed to 0.055
and Kill to 0.062 shifts it to the finer coral regime; the theme re-tints it
whole (Ember gives orange coral); switching away and back reseeds into fresh
young colonies. `plasma` is gone from the switcher. All 8 modes and 8 passes
run together, overlay empty, no console errors.

Sources: Turing 1952; Pearson's parameterisation via
[Munafo's atlas](http://www.mrob.com/pub/comp/xmorphia/index.html);
[Karl Sims' tutorial](https://www.karlsims.com/rd.html) (see REFERENCES.md).

---

## Phase 5 — Waveform replaces pulse

The oldest read in the genre, and the one FLUX couldn't do at all until the
audio texture landed: the actual time-domain signal drawn as a glowing line.
iTunes inherited it from SoundJam, SoundJam from Winamp, and all of them
mirrored it into symmetry. `pulse` is retired to make room — the user's call
("not my favourite kind of visually").

- **Three traces** (`Trace` control): **Line**, **Mirror** (the frame folded
  about the centre so the trace and its reflection are one shape rather than
  two) and **Radial** (angle standing in for time).
- **Even line thickness.** Distance to the curve divides the vertical
  distance by the slope; without that a steep section of the trace draws
  several times fatter than a flat one, which is the tell of a naive
  waveform shader.
- **The ring has no seam.** Wrapping the angle puts the start and end of the
  sampling window next to each other — unrelated samples, so the ring breaks
  visibly at one edge. Folding the angle instead puts them on opposite sides
  and makes the ring symmetric top to bottom, which this family of
  visualizers does anyway.
- **Echoes** are the same trace at growing phase offsets, each dimmer and
  further along the theme ramp, so the line drags a coloured ribbon.
- It holds still because the sampling window is triggered on a rising zero
  crossing (Phase 5's first commit) — without that the trace slides sideways
  every frame and none of this reads.

Verified: build clean, 80/80 tests. In the Preview browser all three traces
render against a played file and follow the signal: Mirror gives the
symmetric iTunes read, Line the oscilloscope with its ribbon, Radial a clean
closed loop with the seam gone. `pulse` is absent from the switcher and the
bar's cycler; the 8 modes and 8 passes all still compile and run together.
Overlay empty, no console errors.

---

## Phase 5 — Warp feedback: MilkDrop's signature move

FLUX has had a history buffer since Phase 1 and used it for exactly one thing:
a straight decay trail. `warp` is the same buffer with a *moving coordinate
field* in front of it — each frame samples the previous frame through a
displaced UV field, so the image is continually pulled through itself. Zoom
alone gives tunnels, rotation gives spirals, the sine terms give the liquid
churn. It's the reason MilkDrop presets look like nothing else, and it pairs
with kaleidoscope into the mandala the genre is known for.

- **Geiss's vocabulary as controls** (Warp Zoom / Rotate / Warp / Decay /
  Drive): zoom 1 = still, <1 out, >1 in; warp 0 none, 1 normal, 2 major.
  MilkDrop evaluated these on a coarse vertex mesh and interpolated between
  them; a fragment shader does it **per pixel**, which is strictly better and
  costs nothing extra.
- **`uDt` is now a builtin.** Anything that compounds frame over frame has to
  know how long a frame was, or it moves twice as fast at 120 fps as at 60 —
  MilkDrop's per-frame model has exactly that bug. Every step here is scaled
  to a 60 fps frame.
- **Two places where Geiss's numbers don't carry over**, both because MilkDrop
  draws sparse geometry into its feedback buffer while FLUX feeds it a
  full-screen mode:
  - *Additive is wrong here.* `cur + prev*decay` converges on
    `cur/(1-decay)` — about 66× at decay 0.97. Fine for sparse waves, a
    white-out for a full-screen source. `max(cur, prev*decay)` is bounded by
    the brightest thing on screen, so Decay can go to 0.995 for long tunnels
    without burning out.
  - *Decay defaults to 0.90, not his 0.98.* Above ~0.95 every pixel keeps
    getting re-lit and the image washes out; at 0.90 the mode keeps its
    structure with the pull on top. Both deviations are commented where they
    live.
- Audio: bass leans on the zoom, mid on the rotation, `uBeat` snaps the warp.
  Sampling outside the frame fades to black rather than dragging the edge
  pixel inward, which would smear the border.

Verified: build clean, 80/80 tests. In the Preview browser the pass measurably
works, not just plausibly: reading the live backbuffer, the band down the far
left of the `logo` mode — well outside its ring, background otherwise — is
**2.1× brighter with warp on** (13.9 vs 6.8) and returns to 13.7 when toggled
back on, so the feedback genuinely pulls content across the screen and
switching it off is a clean no-op. `flow` + `warp` + `kaleido` renders the
deep fractal mandala this technique is for. All 8 modes still render, all 8
passes run simultaneously, overlay empty, no console errors.

Source: [MilkDrop preset authoring guide](https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html)
(see REFERENCES.md).

---

## Phase 5 — Bars stops faking it

`bars` has always been a lie: `barHeight()` spread three band values across
the columns with Gaussian weights and multiplied in animated noise "so
neighbours dance independently". It looked alive because it *was* animated —
just not by the music. A single sine tone lit up the whole display.

- **Every column now reads its own slice of the spectrum**, averaged over four
  samples across the slice so it reads a band rather than one arbitrary bin
  (which is what stops a tall thin column flickering as a note drifts). The
  noise wobble is gone; it has nothing left to hide.
- **The axis is logarithmic** — `spectrumLog()` spans nine octaves, roughly
  30 Hz to 15 kHz. An octave gets the same width wherever it sits, so bass
  doesn't crush into two columns and the top end isn't a dead zone. Below 30 Hz
  is rumble and above 15 kHz is air; giving either room only spends display on
  silence.
- **`SpectrumSmoother`** gives all 512 bins the same fast-attack /
  slow-release envelope the bands get (12 ms up, 220 ms down, framerate
  independent). Raw FFT bytes flicker — the analyser's own smoothing is off
  because it's symmetric and would mute transients — so bars now snap up on a
  hit and settle, without any wobble faked in the shader.

Verified: build clean, 80/80 tests (the smoother's attack/release asymmetry,
per-bin independence, framerate independence and reset are all unit-tested).
In the Preview browser, an exponential sweep from 30 Hz to 15 kHz walks a
single peak across the display, and it lands where the arithmetic says: at
≈72 Hz the peak is at x≈0.13, at ≈930 Hz at x≈0.5, at ≈6.8 kHz at x≈0.86,
each within a bar's width of prediction — and the level meters follow it from
bass to mid to high. A single sine now lights a single bar. Overlay empty,
no console errors.

---

## Phase 5 — The audio texture: shaders can finally see the sound

Until now a FLUX shader got six numbers — bass, mid, high, level, beat,
onset — and nothing else. That's why `bars` fakes its spectrum out of three
band values, and why no mode can draw a waveform, the one thing every
visualizer in the iTunes/MilkDrop lineage does. Shaders now get the analyser's
actual output as a texture.

- **`uAudio`** — 512×2, R8, uploaded once per frame (`texSubImage2D` into a
  texture allocated at boot). **Shadertoy's layout**: row 0 the FFT spectrum,
  row 1 the time-domain waveform. Copying the convention rather than inventing
  one means an audio-reactive Shadertoy shader ports to a FLUX mode with a
  uniform rename — the largest library of reference material in this space
  becomes usable. LINEAR filtering so a shader can sample between bins and get
  a curve rather than a staircase; CLAMP so the top of the spectrum can't wrap
  onto the bottom.
- **Bound in `uploadFrameUniforms`** (unit 5), the one place every program
  passes through, so fragment modes, post-passes, custom 3D modes and the
  present pass all get it without a second thought.
- **`common.glsl`** gains `spectrum(x)`, `wave(x)` (as -1..1, the useful
  range) and `spectrumLog(x)`, which spreads the spectrum over a log
  frequency axis so an octave takes the same width wherever it sits — how
  music is actually spaced, and how a spectrum wants to be drawn.
- **The bins are folded, not cropped.** 1024 analyser bins average down to
  512 texels, so the top octave survives; taking the first 512 bins of a
  2048-point FFT would have thrown it away.
- **The waveform window is triggered**, like an oscilloscope: it starts at a
  rising crossing of the 128 midpoint. Without it the trace slides sideways
  every frame, because the analyser's window has no relationship to the
  signal's phase.

The six scalars stay exactly as they were — they're the *musical* reading,
smoothed and opinionated. This is the raw material next to them.

Verified: build clean, 75/75 tests (the packing, the fold, and the trigger's
phase alignment are all pure and unit-tested). In the Preview browser, a
temporary probe shader — installed in `plasma`, reverted before commit —
drew both rows while a two-tone WAV played, and the result matches the
arithmetic exactly: a tone at `sampleRate/8` peaked precisely on the 0.25
ruler (bin 256 → texel 128 of 512) and a 440 Hz tone at x≈0.02, while the
waveform row showed 5 cycles of 440 Hz across its 11.6 ms window with the
high tone riding on it. All 8 modes and 7 passes still compile and render;
overlay empty, no console errors.

Sources: [Shadertoy "Input - Sound"](https://www.shadertoy.com/view/Xds3Rr)
for the layout; [soulthreads' notes](https://gist.github.com/soulthreads/2efe50da4be1fb5f7ab60ff14ca434b8)
for the byte normalisation (see REFERENCES.md).

---

## NEEDS DECISION — two modes' futures (research round, 2026-09-16)

> **RESOLVED (2026-09-16): both as proposed.** `pulse` is replaced by the
> waveform mode; `plasma` is re-cast as Gray-Scott reaction-diffusion. Phase
> 5 proceeds in roadmap order.

The iTunes/MilkDrop research is logged in
[`REFERENCES.md`](REFERENCES.md) and the work it implies is planned as
**Phase 5** in [`ROADMAP.md`](ROADMAP.md). Two of those tasks delete or
replace something the user already has, so they wait for his call:

1. **`pulse`** — "not my favourite kind of visually". The proposal is to
   replace it with a **waveform mode**: the time-domain line, mirrored and
   glowing, which is the one thing every visualizer in this lineage does and
   FLUX cannot do at all. Alternative: keep `pulse` and add waveform as a
   ninth mode.
2. **`plasma` vs `flow`** — "they're kind of doing the same thing for me,
   I prefer flow". Both are domain-warped fbm, so the overlap is real, not
   imagined. Options: (a) retire `plasma`; (b) re-cast it as Gray-Scott
   **reaction-diffusion** — a genuine simulation with organic growth, which
   is structurally unlike anything else in the set.

Everything else in Phase 5 is additive and needs no decision: the audio
texture (real spectrum + waveform, Shadertoy's 512×2 layout), honest bars,
the MilkDrop warp-feedback pass, a magnetosphere particle mode, and a set of
curated built-in looks (the user's own open question: which effect combos are
worth using).

---

## PHASE 3 COMPLETE — review

Phase 3 landed in three verified commits, and FLUX now has a performance
surface rather than only a workbench:

1. **File playback** — drop a track on the stage, transport in the panel,
   Space to play/pause; mic and file share the one input dropdown.
2. **Global themes** — five palettes on the `1`-`5` keys that all eight modes
   bend toward, keeping each mode's own brightness so nothing goes muddy.
3. **The floating bar** — the mid-set controls over the visual, fading out
   when the mouse goes still.

**For the user, live in Chrome with music:** drop a real track, hit
fullscreen from the bar, and walk the five themes on `1`-`5` across your
favourite modes — the Tint slider in the panel decides how far each mode is
pulled toward the theme, and 0.85 is only a starting guess at your taste.
The two things only you can check are still open: the **Traktor S2 MIDI
verification** and, from Phase 4, the sustained-FPS and by-ear pass on
`trails3d` with bloom + trails enabled.

---

## Phase 3 — The floating performance bar

A pill over the visual holding the handful of controls you actually reach for
mid-set: source (mic / file), the file transport, the five theme swatches, a
mode cycler, fullscreen and PiP. It fades out after ~2.6 s of a still mouse —
the picture is the point — and comes back on the first movement. Hovering
pins it open, and while faded it stops taking clicks, so nothing can be hit
blind.

The rule the whole thing is built on: **every control is a second view, never
a second source of truth.** The swatches write the same `uTheme` control the
panel's selector does; the play button calls the same `Transport`; the mode
cycler goes through `selectMode`; fullscreen and PiP call the same two
functions the Output section calls, and both repaint from one `pipPainters`
list, so the PiP state can't read differently in two places. New seams that
made that possible: `Transport.watch()` (mirror the element's state),
`SourcePicker.selectFirstDevice()`, `Transport.openFilePicker()`, and the
`ControlPanel.onChange` hook from the theme task. The dock panel is unchanged
and still collapses on its own.

`stepIndex` is the one bit of logic worth pinning down and is unit-tested:
JS `%` keeps the sign of the left operand, so walking off the front of the
mode list needs the double-modulo or it lands on -1.

Verified: build clean, 64/64 tests. In the Preview browser: the bar renders
centred with all five groups; the cycler walks all 8 modes and wraps both
ways (bars → trails3d → bars) with the panel's mode buttons following; a bar
swatch sets the panel's theme and a `1`-`5` hotkey moves the bar's ring, both
ways; dropping a file grows the transport group, and play/pause stays in sync
whichever of the two buttons is pressed; the bar goes `idle` (opacity 0,
pointer-events none) after 3 s untouched, returns on pointermove, and stays
put while hovered. PiP and mic from the bar hit the shared paths and surfaced
the Preview browser's own refusals visibly, leaving no orphaned `<video>` and
no stale button label. Error overlay empty, no new console errors.

---

## Phase 3 — Global theme palettes + hotkeys

FLUX looked like eight instruments: every mode invented its own colour, so
switching modes mid-set switched palettes too. It now has one global colour,
chosen in the panel or on the `1`-`5` keys, that all eight modes bend toward.

- **Five themes** (`src/ui/themes.ts`) — Ultra, Ember, Ice, Acid, Mono; three
  stops each. The table lives in TypeScript because two places need it: the
  uniforms the shaders read, and the swatches the UI shows.
- **`themed(col, t)`** (`common.glsl`) — the whole idea in four lines. Modes
  keep their own colour logic and hand the result over on the way out;
  `themed` takes the hue from the theme ramp and the **brightness from the
  mode**, dividing out the tint's own luminance. That's what stops a dark
  stop from dimming the image or a pale one from blowing it out, so contrast,
  highlights and shape survive a full re-tint — at Tint 1.0 cells reads as
  real fire under Ember and still shows every cell edge.
- **Where each mode indexes the ramp** matters as much as the ramp: bars by
  bar position, cells by cell id, plasma and flow by their field value,
  raymarch by brightness, trails3d by particle age (heads and tails take
  different stops, so the comet read survives). The uploaded logo is *not*
  tinted — only the glow field behind it — because re-colouring somebody's
  logo is vandalism.
- **Tint** (`uThemeMix`) defaults to 0.85: high enough that a theme reads as
  itself, low enough to keep a trace of each mode's own colour. Pull it to 0
  for the native look.
- **Hotkeys** (`src/ui/hotkeys.ts`) — the seam, not just the digits: one
  window listener, bindings of code + description + action, and a shared
  `isTypingTarget` guard so a focused field keeps its spaces and digits (a
  focused button already fires its own click on Space). Space moved onto it.
- **`ControlPanel.onChange`** — the plumbing that keeps this honest. The
  Theme selector doesn't write the colours; a subscriber does, so hotkeys,
  MIDI and preset recall all reach the same code. The three colour controls
  are widgetless members of the normal store, so they're declared, uploaded
  and serialised like any other control: a preset restores the colours it was
  saved with even if the table later changes.
- `luma()` is now defined once in `common.glsl` — the bloom bright-pass had
  its own identical copy, which collided the moment the theme needed one.

Verified: build clean, 60/60 tests. In the Preview browser, all 8 modes and
all 7 passes compile and run with the new helpers (error overlay empty after
cycling every one, and the console gained no new errors). Themes were
switched by hotkey with the panel's swatch following: cells went violet
(Ultra) → fire (Ember), flow went cold blue (Ice), bars went magenta/lime
(Acid) — three modes, visibly re-tinted, screenshotted. A preset saved under
Acid stored `theme: 3` plus `#ff2fd0` as themeA, and recalled correctly
after switching to Ultra.

---

## Phase 3 — Audio file playback source

FLUX can now be driven by a track, not just the room. A second `AudioSource`
sits beside the mic and the dropdown stays the single answer to "what is
driving the visuals?".

- **`createFileSource`** (`src/audio/sources.ts`) — an `<audio>` element
  through a `MediaElementAudioSourceNode`, chosen over `decodeAudioData` so
  seeking, duration and play/pause are the element's job and long files
  stream instead of sitting decoded in memory. It's the first `monitor: true`
  source: once an element is captured, the graph is its only route to the
  speakers. Load failures name the file and the reason (`MediaError` codes);
  a failure mid-playback warns rather than freezing the visuals silently.
- **Transport** (`src/ui/Transport.ts`) — a File section with load,
  play/pause, a seek scrubber and a `m:ss / m:ss` readout, hidden until
  something is loaded. It repaints off the element's own events
  (`timeupdate` ≈ 4 Hz), never from the render loop, so it can't cost frames.
- **Drop anywhere** — the whole window is the target, with a dashed overlay
  that says so; `dragenter`/`dragleave` are counted rather than trusted.
  **Space** plays/pauses, standing down for focused inputs, selects and
  buttons (a focused button fires its own click; preset names need spaces).
- **Picker** (`src/ui/SourcePicker.ts`) — the loaded file joins the dropdown
  in its own optgroup above the live inputs, so swapping file ⇄ mic is the
  same gesture as swapping mic ⇄ mic. The `File` is kept, because a
  MediaElementSourceNode is single-use: reselecting rebuilds the source.
- **`src/audio/files.ts`** — the two pure decisions, unit-tested: which file
  to take from a drop (MIME decides when there is one; extensions only get a
  say when the browser gave us nothing, and `.mp4`/`.webm` are deliberately
  not on that list) and how to print a time (`0:00` for an unknown duration,
  never `NaN:aN`).

No microphone permission is involved — the click or the drop is the gesture
that unlocks the AudioContext, so a track can be playing seconds after load.

Verified: build clean, 51/51 tests. In the Preview browser, a generated WAV
dropped on the stage loaded, played, and drove the analyser — a 55 Hz kick
read bass 41–70% / level 54–99%, and after swapping to a 440 Hz second file
the same meters read bass 2.4% / mid 10.3%, which is the new file being
analysed, not a stale one. Scrubbing through the widget moved playback (the
readout followed), Space toggled play/pause while a focused text field kept
its spaces, a `.txt` drop was refused with a visible warning, the swap left
exactly one transport and one source, and bars visibly reacted in the
screenshot. Error overlay empty on a fresh load, no console errors.

---

## PHASE 4 COMPLETE — review

True 3D landed in three verified commits, dependency-free as decided:

1. **Spike** (`spikes/curl-noise-3d.html`) — proved the raw-WebGL2 path;
   decision gate recorded and user-confirmed (no Three.js).
2. **Custom-draw mode seam** — `CustomMode` draw callbacks into the scene
   FBO (optional depth), `math3d.ts` camera helpers (tested), standard
   uniform preamble for custom fragments. Fragment modes untouched.
3. **`trails3d`** — the target visual: a GPGPU curl-noise particle swarm
   (16k–262k), audio-reactive (bass→flow, kick→radial burst, highs→sparkle),
   composited through HDR bloom/trails/tonemap.

FLUX now has 8 modes; the stack remains vanilla TS + raw WebGL2 with zero
runtime dependencies (~89 kB bundle). **For the user, live in Chrome with
music:** enable bloom + trails on `trails3d`, confirm it flows smoothly at
your resolution (drop Particles to 16k if not), feel the kick bursts, and
tune Flow/Turbulence to taste. Earlier open items still standing: the MIDI
hardware check (Traktor S2) and the Phase 3 group (file playback, theme
hotkeys, floating performance bar), which is now the natural next phase.

---

## Phase 4 — trails3d: the curl-noise particle mode (the target visual)

The mode the user always wanted: **`trails3d`** is now a real GPGPU
curl-noise particle swarm — the spike's technique productionised through the
custom-draw seam, composited by the HDR post chain (enable **bloom** and
**trails** for the full flowing-comet look).

- **Simulation** (`src/shaders/modes3d/`) — positions + ages ping-pong in
  float textures (RGBA32F, 16F fallback, probed); a sim pass advects every
  particle through divergence-free curl noise (shared `curl.glsl`: Ashima
  simplex MIT + Bridson 2007 construction) with a soft spring to the host
  sphere; staggered respawns.
- **Audio** — bass deepens the flow speed, **uBeat fires a radial burst**
  (squared pulse = sharp kick attack), highs sparkle the points, level lifts
  luminance. Heads render cool-blue shading to violet tails by age.
- **Controls** — Particles (16k / 65k / 262k — texture size, the perf story
  for weak GPUs), Flow, Turbulence, plus shared Scale (host size) and Gain.
  Count changes reallocate + reseed lazily, like the bloom pyramid.
- **Bug found the hard way**: `createFbo`'s LINEAR default makes an RGBA32F
  texture *sampling-incomplete* (32F isn't filterable without
  `OES_texture_float_linear`) — every `texelFetch` silently returned
  `(0,0,0,1)` and the swarm collapsed to the origin. Data textures now get
  NEAREST explicitly; diagnosed by manually re-running the seed/sim passes
  and reading pixels back through a temporary debug handle (removed).

Sources: as the spike — Barradeau FBO particles, Bridson 2007, Ashima/stegu
webgl-noise (MIT), cabbibo/glsl-curl-noise, Codrops audio-reactive particles
(see REFERENCES.md).

Verified: build clean, 43/43 tests; Preview shows the 65k swarm flowing
around the host with bloom + trails enabled and evolving between frames;
sim texture read-back confirms healthy state (positions spread 0.65–1.19
around the host radius, ages staggered 0.75–5.4); mode switch to cells and
back is clean; error overlay empty, console clean. Audio reaction rides the
same uniforms proven live in Phase 2b; **sustained FPS and the by-ear taste
pass need the user's Chrome + music** (embedded pane pumps rAF only during
capture).

---

## Phase 4 — Custom-draw mode seam (true 3D unlocked)

The Renderer can now host modes that *draw*, not just shade: a **`CustomMode`**
(`src/render/CustomMode.ts`) receives the GL context at registration and a
draw callback per frame with the scene FBO bound — geometry, GPGPU passes,
points — while the mode switcher, control scoping, and the entire HDR post
chain keep working unchanged. Mirrors the BloomPipeline special-case pattern.

- **Renderer** — `registerCustomMode` / dispatch in `setMode` and the render
  loop; `composeCustomFragment` gives custom fragments the standard uniform
  preamble (builtins, controls, `common.glsl`) with their own ins/outs/main;
  `compile` accepts custom vertex sources; mode-private uniforms follow the
  established body-declared pattern. Context services: `buildModeProgram`,
  `uploadFrameUniforms`, `rebindScene`, the HDR `fboFormat`.
- **`Framebuffer.ts`** — optional `DEPTH_COMPONENT24` renderbuffer on an Fbo;
  the scene FBO gains depth only when a registered mode asks (none yet — the
  planned trails mode is additive).
- **`src/render/math3d.ts`** — the whole "camera library" the raw path needs:
  `perspective` + `lookAt`, pure and unit-tested (43 tests total).
- **Demo mode `trails3d`** (`src/modes3d/Trails3DMode.ts`) — task 4-2 proof:
  an attribute-less audio-breathing point sphere (positions from
  `gl_VertexID`), slow-orbit perspective camera, additive points, Scale
  control scoped in. Task 4-3 replaces its internals with the spike's GPGPU
  curl-noise advection.

Verified: build clean, 43/43 tests; Preview shows trails3d rendering through
the post chain (bloom composites the point sphere; scoped controls appear),
fragment modes unchanged (cells spot-check), error overlay empty, console
clean.

---

## NEEDS DECISION — Phase 4 3D layer: raw WebGL2 (recommended) vs Three.js

> **RESOLVED (2026-06-11): user confirmed raw WebGL2.** Tasks 4-2/4-3
> proceed dependency-free on the existing stack.

The Phase 4 tech spike is done and working:
[`spikes/curl-noise-3d.html`](../spikes/curl-noise-3d.html) — a
self-contained, zero-dependency **raw WebGL2** GPGPU prototype (~340 lines,
no build step, served at `/spikes/curl-noise-3d.html`): 65,536 particles
advected by divergence-free curl noise (Ashima simplex, MIT; Bridson 2007
curl construction) over a sphere host with a soft spring, position ping-pong
in RGBA32F textures, points drawn from `gl_VertexID` through a hand-rolled
perspective/orbit camera, trail persistence via a fade quad. The
melt.graphics-style flowing-surface look is clearly present.

**Recommendation: raw WebGL2.** Rationale:
- The spike proves the target look needs only ~340 dependency-free lines —
  FLUX already owns the hard parts (float-FBO ping-pong, GLSL composition).
- The real mode reuses FLUX seams directly: `Framebuffer.ts` for the data
  textures, the HDR post chain for bloom/trails/tonemap, the control schema
  for steering. Three.js would introduce a second GL-state owner fighting
  the Renderer for context state, render targets, and texture units.
- Keeps the settled zero-runtime-dependency posture (~76 kB total today;
  Three.js core alone is ~150 kB min+gzip).
- What Three.js would buy — camera/controls, `GPUComputationRenderer`,
  mesh loading — is either already written (camera: ~40 lines in the spike)
  or not needed for the planned mode (parametric hosts are generated in
  GLSL, not loaded).

Verified: spike renders and animates in the Preview pane (screenshots),
console clean; main build + 40/40 tests untouched (spike excluded from the
bundle). Caveat: the embedded pane only pumps rAF during screenshot capture,
so **sustained FPS could not be measured here** — check it in desktop Chrome
(open `/spikes/curl-noise-3d.html`, read `__fps` in devtools); the real mode
carries a particle-count control as its perf story regardless.

**Question for the user:** confirm raw WebGL2 for the Phase 4 3D layer
(recommended), or direct the switch to Three.js. Tasks 4-2 (custom-draw mode
seam) and 4-3 (the trails mode) proceed on the chosen path.

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
