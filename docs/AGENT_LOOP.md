# FLUX Autonomous Loop Protocol

This is the exact procedure to follow on each loop iteration. The goal: make
real, verified progress on `ROADMAP.md` — one task at a time — without a human
in the loop, while keeping every change reviewable and reversible.

## The one rule

**One task per iteration.** Take the first unchecked task, finish it
completely (including verification, commit, and docs), then stop. Do not start
a second task.

## Procedure

### 1. Pick the task
- Read `docs/ROADMAP.md`. Take the **first unchecked `- [ ]` task** under the
  current phase.
- Confirm the working tree is clean (`git status`). If it isn't, something from
  a prior run is unfinished — inspect, finish or revert it, don't pile on.
- **If the task needs a human product decision** (genuinely ambiguous, not just
  an aesthetic judgment you can research): do **not** guess. Add a dated
  `## NEEDS DECISION` entry to `docs/CHANGELOG.md` describing the question and
  options, commit only that, and stop.

### 2. Research first (mandatory for any visual/aesthetic task)
- Web-search the technique. Study open-source and reference implementations:
  Shadertoy, Inigo Quilez (iquilezles.org), the dithering tutorials in
  `docs/sprint-2-research.md`, awesome-audio-visualization, etc.
- Note what's currently trending / considered good for music visualization.
- Prefer adapting proven, well-licensed open-source approaches over inventing
  from scratch. **Record the sources** — you'll cite them in the commit and
  CHANGELOG.

### 3. Implement
- Follow the existing module seams (see `README.md`). Key ones:
  - New shader mode = a `vec3 render(vec2 uv)` `.frag` + an entry in
    `src/shaders/modes.ts`. The Renderer composes the header/uniforms/common.
  - New control = an entry in `src/ui/controls.ts`; it auto-wires to a slider
    and a uniform. No other change needed (until control-types land).
  - Post-passes (once the pipeline exists) = the `PostPass` seam on `Renderer`.
- Keep every failure visible via the error overlay (`src/core/errors.ts`). Never
  swallow errors.
- Match the house style; keep diffs focused on the one task.

### 4. Verify (all gates must pass)
- `npm run build` exits 0 (type-check + bundle).
- `npm test` passes (if tests exist).
- **Visual gate** via the Preview MCP:
  - `preview_start` the dev server.
  - `preview_screenshot` — save it; it goes in the CHANGELOG entry so the human
    can eyeball the result later.
  - `preview_console_logs` at level `error` — must be empty.
  - Assert the on-screen error overlay (`#errors`) is empty (no shader failed to
    compile). Use `preview_eval` to check
    `document.getElementById('errors')?.childElementCount === 0` if needed.
- If any gate fails: fix it within this iteration, or if unfixable, revert the
  change (`git checkout -- .`), record what blocked you in `CHANGELOG.md`, and
  stop. Never commit a red build.

### 5. Commit
- Stage and commit the change with a clear message and a `Changelog:` trailer
  (house convention), citing research sources in the body for visual tasks.
  Example:
  ```
  Add Bayer ordered-dither post-pass

  4x4 / 8x8 Bayer threshold matrix, toggleable, matrix size as a control.
  Adapted from hughsk/glsl-dither (MIT) and the Codrops dithering tutorial.

  Changelog: Add toggleable Bayer dither post-effect
  ```
- **Never push.** Local commits only.

### 6. Log + tick
- Add a plain-English entry to `docs/CHANGELOG.md` (newest first): what changed,
  why, sources cited, and the saved screenshot path.
- Tick the task in `docs/ROADMAP.md` (`- [ ]` → `- [x]`).
- Commit those doc updates (can be folded into the step-5 commit if done
  together).

### 7. Stop
Leave the tree clean. The next iteration starts fresh from step 1.

## Splitting a task that's too big
If the first unchecked task can't be finished in one iteration, don't half-do
it. Replace it in `ROADMAP.md` with 2–3 smaller `- [ ]` tasks, commit that
planning change, and stop. The next iteration picks up the first sub-task.

## Guardrails
- One task per iteration; never push; never commit a failing build.
- Research before any aesthetic decision; cite sources.
- Keep failures visible; keep diffs focused.
- When genuinely blocked on a human decision, flag it in CHANGELOG and stop.
