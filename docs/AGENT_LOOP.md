# FLUX Autonomous Loop Protocol

This is the exact procedure to follow when building FLUX autonomously. The goal:
make real, verified progress on `ROADMAP.md` — working through tasks
continuously — while keeping every change reviewable and reversible.

## The model

**Work through tasks continuously; commit each one atomically.** Each run takes
the first unchecked task, completes it fully (research → implement → verify →
commit → log → tick), then **immediately moves on to the next unchecked task**,
and keeps going until a **stop condition** is hit.

Per-task commits are non-negotiable: they're what make a long autonomous run
safe. Every task is its own atomic, reversible checkpoint in `git log`, narrated
in `CHANGELOG.md`. "Continuous" never means "one giant unreviewable change."

### Stop conditions (end the run when any is true)
1. **End of Phase 1.** When the last Phase 1 task in `ROADMAP.md` is ticked,
   STOP. Do not start the Phase 2+ backlog. Add a `## PHASE 1 COMPLETE — review`
   note to `CHANGELOG.md` summarising what landed, and finish.
2. **Blocked on a human decision.** A task needs a genuine product call (not an
   aesthetic judgment you can research). Record it under `## NEEDS DECISION` in
   `CHANGELOG.md`, commit only that, and stop.
3. **Unfixable failure.** A task can't be made to pass verification after a
   reasonable effort. Revert that task's changes (`git checkout -- .`), record
   what blocked you in `CHANGELOG.md`, and stop. Never commit a red build.
4. **Context getting large** (interval-loop hygiene). If this run has already
   completed several tasks and the working context is getting heavy, finish the
   **current** task cleanly (commit + log + tick), then stop. State lives
   entirely in git + `ROADMAP.md`, so the next interval run resumes seamlessly
   with a fresh context.

## Per-task procedure

### 1. Pick the task
- Read `docs/ROADMAP.md`. Take the **first unchecked `- [ ]` task** in Phase 1.
- Confirm the working tree is clean (`git status`). If not, a prior task is
  half-done — inspect, finish or revert it before starting new work.
- Check the stop conditions above before beginning.

### 2. Research first (mandatory for any visual/aesthetic task)
- Web-search the technique. Study open-source and reference implementations:
  Shadertoy, Inigo Quilez (iquilezles.org), the dithering tutorials in
  `docs/sprint-2-research.md`, awesome-audio-visualization, the p5.js
  showcase + OpenProcessing (rich pool of small readable audio-reactive
  sketches — port ideas as native GLSL, never adopt the library), Codrops
  tutorials, and the three.js forum showcases (for 3D/particle techniques).
- Note what's currently trending / considered good for music visualization.
- Prefer adapting proven, well-licensed open-source approaches over inventing
  from scratch. **Record the sources** — cite them in the commit and CHANGELOG.

### 3. Implement
- Follow the existing module seams (see `README.md`). Key ones:
  - New shader mode = a `vec3 render(vec2 uv)` `.frag` + an entry in
    `src/shaders/modes.ts`. The Renderer composes header/uniforms/common.
  - New control = an entry in `src/ui/controls.ts`; it auto-wires to a slider
    and a uniform (until control-types land, then richer types are available).
  - Post-passes (once the pipeline exists) = the `PostPass` seam on `Renderer`.
- Keep every failure visible via the error overlay (`src/core/errors.ts`).
- Keep the diff focused on the one task.

### 4. Verify (all gates must pass before committing)
- `npm run build` exits 0 (type-check + bundle).
- `npm test` passes (if tests exist).
- **Visual gate** via the Preview MCP:
  - `preview_start` the dev server.
  - `preview_screenshot` — save it; reference it in the CHANGELOG entry.
  - `preview_console_logs` at level `error` — must be empty.
  - Assert the error overlay is empty:
    `preview_eval` → `document.getElementById('errors')?.childElementCount === 0`.
- If a gate fails: fix it, or if unfixable, trigger stop condition 3.

### 5. Commit
- Commit the task with a clear message + `Changelog:` trailer, citing research
  sources in the body for visual tasks. Example:
  ```
  Add Bayer ordered-dither post-pass

  4x4 / 8x8 Bayer threshold matrix, toggleable, matrix size as a control.
  Adapted from hughsk/glsl-dither (MIT) and the Codrops dithering tutorial.

  Changelog: Add toggleable Bayer dither post-effect
  ```
- **Never push.** Local commits only.

### 6. Log + tick
- Prepend a plain-English entry to `docs/CHANGELOG.md`: what changed, why,
  sources cited, saved screenshot path.
- Tick the task in `docs/ROADMAP.md` (`- [ ]` → `- [x]`).
- Commit the doc updates (fold into the step-5 commit if done together).

### 7. Next task
- Re-check the stop conditions. If none apply, return to step 1 for the next
  unchecked task. Otherwise, end the run with a clean working tree.

## Splitting a task that's too big
If a task can't be finished as one atomic commit, don't half-do it. Replace it in
`ROADMAP.md` with 2–3 smaller `- [ ]` tasks, commit that planning change, and
continue with the first sub-task.

## Guardrails (always)
- Commit per task; never push; never commit a failing build.
- Research before any aesthetic decision; cite sources.
- Keep failures visible; keep diffs focused.
- Stop at the end of Phase 1, when blocked on a human decision, on an unfixable
  failure, or when context grows heavy. State is always recoverable from git +
  `ROADMAP.md`.
