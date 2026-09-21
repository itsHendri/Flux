import './styles.css';
import { App } from './App.ts';
import {
  installGlobalErrorHooks,
  reportError,
  reportWarning,
  clearErrors,
} from './core/errors.ts';
import { AudioEngine } from './audio/AudioEngine.ts';
import { Renderer } from './render/Renderer.ts';
import { createFileSource, createMicSource } from './audio/sources.ts';
import { pickAudioFile } from './audio/files.ts';
import {
  listAudioInputs,
  onDeviceChange,
  requestAudioPermission,
} from './audio/devices.ts';
import { CONTROLS } from './ui/controls.ts';
import { THEMES, THEME_COLOR_CONTROLS, themeValues } from './ui/themes.ts';
import { Hotkeys } from './ui/hotkeys.ts';
import { passToggleDefs, passToggleUniform } from './core/state.ts';
import { MODES, onModesChanged } from './shaders/modes.ts';
import { PASSES, onPassesChanged } from './shaders/passes.ts';
import { Trails3DMode } from './modes3d/Trails3DMode.ts';
import { MagnetoMode } from './modes3d/MagnetoMode.ts';
import { ForgeMode } from './modes3d/ForgeMode.ts';
import { SynapseMode } from './modes3d/SynapseMode.ts';
import { AnemoneMode } from './modes3d/AnemoneMode.ts';
import { WispMode } from './modes3d/WispMode.ts';
import { ReactionMode } from './modes2d/ReactionMode.ts';
import { FluidMode } from './modes2d/FluidMode.ts';
import { SpectrogramMode } from './modes2d/SpectrogramMode.ts';
import { VectorMode } from './modes2d/VectorMode.ts';
import { GateMode } from './modes2d/GateMode.ts';
import { patternValues } from './modes2d/patterns.ts';
import { ControlPanel } from './ui/ControlPanel.ts';
import { SourcePicker } from './ui/SourcePicker.ts';
import { Transport } from './ui/Transport.ts';
import { PerformanceBar, stepIndex } from './ui/PerformanceBar.ts';
import { groupModes, modeOrder } from './ui/modeGroups.ts';
import { PresetPanel } from './ui/PresetPanel.ts';
import { PresetStore, snapshotPreset, resolvePreset } from './presets/presets.ts';
import { LOOKS, defaultValues, findLook } from './presets/looks.ts';
import { MidiPanel } from './ui/MidiPanel.ts';
import { SetPanel } from './ui/SetPanel.ts';
import { loadSet, saveSet } from './ui/setSettings.ts';
import { PhraseClock } from './audio/PhraseClock.ts';
import { LookSequence } from './presets/lookSequence.ts';
import { MidiEngine, MidiMap, MidiBindingStore } from './audio/midi.ts';
import {
  QualityGovernor,
  QUALITY_LEVERS,
  loadAutoQuality,
  saveAutoQuality,
} from './core/governor.ts';

installGlobalErrorHooks();

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const panel = document.getElementById('panel');
if (!canvas || !panel) {
  reportError('boot', 'Missing #stage canvas or #panel element in index.html.');
  throw new Error('boot: missing DOM elements');
}
// Non-null alias: the guard above narrows `canvas` here, but not inside the
// functions declared below, which run long after this line.
const stage: HTMLCanvasElement = canvas;

// Panel header.
const title = document.createElement('div');
title.className = 'panel-title';
title.textContent = 'FLUX';
panel.appendChild(title);

// Dockable panel — a single toggle floats top-right; clicking docks the panel
// in or out so the visuals can take the full screen.
const panelToggle = document.createElement('button');
panelToggle.id = 'panel-toggle';
panelToggle.title = 'Toggle panel';
panelToggle.setAttribute('aria-label', 'Toggle panel');
panelToggle.innerHTML =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/>' +
  '<line x1="15" y1="4" x2="15" y2="20"/></svg>';
panelToggle.addEventListener('click', () => panel.classList.toggle('collapsed'));
document.body.appendChild(panelToggle);

// --- Renderer -------------------------------------------------------------
// Pass-enable state is typed controls like everything else (uFx* toggles):
// declared as uniforms, stored alongside the other control values, read by the
// Renderer to build the chain. One serialisable home for all live state.
const passToggles = passToggleDefs(PASSES.map((p) => p.name));
// The theme's three colours are controls with no widget of their own: the
// Theme selector writes them, every shader reads them (see themed() in
// common.glsl), and presets carry them like any other value.
const allControls = [...CONTROLS, ...passToggles, ...THEME_COLOR_CONTROLS];

let renderer: Renderer;
try {
  renderer = new Renderer(canvas, allControls);
} catch (e) {
  reportError('renderer', e);
  throw e;
}

renderer.onError((e) => reportError(`shader:${e.mode}`, e.log));
renderer.onCompileSuccess((mode) => clearErrors(`shader:${mode}`));

for (const mode of MODES) renderer.registerMode(mode);
// Custom-draw (true 3D) modes — same switcher, same controls, same post
// chain. Only successfully registered ones get switcher buttons (a mode can
// refuse, e.g. trails3d without float render targets).
// Custom-draw modes: `reaction` holds a chemical simulation, `trails3d` a
// particle one. Both need state across frames, which a fragment mode can't
// have, and both refuse to register without float render targets.
const MODES_3D = [
  new ReactionMode(),
  new FluidMode(),
  new SpectrogramMode(),
  new VectorMode(),
  new MagnetoMode(),
  new Trails3DMode(),
  new ForgeMode(),
  new SynapseMode(),
  new AnemoneMode(),
  new GateMode(),
  new WispMode(),
].filter((m) => renderer.registerCustomMode(m));
for (const pass of PASSES) renderer.registerPass(pass);

// --- Audio ----------------------------------------------------------------
const audio = new AudioEngine({ fftSize: 2048 });

// --- UI -------------------------------------------------------------------
// Widgetless controls live in the same store with no panel widget: the pass
// toggles (the Effects row is their UI), the theme colours (written by the
// Theme listener), Theme itself (the bar's swatches and keys 1-5 own it), and
// Tonemap. Tonemap only matters once effects push brightness past 1.0, so as a
// panel control it mostly looked like it did nothing; the looks still set it,
// which is where it earns its keep (it's what stops bloom clipping to white).
const PANEL_HIDDEN = new Set(['theme', 'tonemap']);
const controlPanel = new ControlPanel(
  panel,
  CONTROLS.filter((c) => !PANEL_HIDDEN.has(c.id)),
  [...CONTROLS.filter((c) => PANEL_HIDDEN.has(c.id)), ...passToggles, ...THEME_COLOR_CONTROLS],
);
const isPassEnabled = (name: string): boolean =>
  controlPanel.getValue(passToggleUniform(name)) >= 0.5;

const app = new App(audio, renderer, controlPanel);

// --- Performance governor -------------------------------------------------
// Watches frame time and, when the machine falls behind, steps the showing
// mode's own quality lever down, then the render resolution; steps back up
// when it recovers (see core/governor.ts). Its writes go through the control
// store like anything else, so the panel shows what it did.
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const governor = new QualityGovernor({
  leverFor: (mode) => {
    const lever = QUALITY_LEVERS[mode];
    const def = lever ? CONTROLS.find((c) => c.glslName === lever.glslName) : undefined;
    return def?.options
      ? { glslName: def.glslName, options: def.options.map((o) => o.value), scaleFirst: lever.scaleFirst }
      : null;
  },
  getValue: (n) => controlPanel.getValue(n),
  setValue: (n, v) => controlPanel.applyValues({ [n]: v }),
  setRenderScale: (scale) => renderer.setRenderScale(scale),
});
for (const lever of new Set(Object.values(QUALITY_LEVERS).map((l) => l.glslName))) {
  controlPanel.onChange(lever, (v) => {
    if (typeof v === 'number') governor.onLeverChanged(lever, v);
  });
}
governor.setEnabled(loadAutoQuality(storage));
// During a crossfade two modes render at once; that doubled cost is the
// fade's, not the machine's, so the governor sits it out.
app.onFrame((dt) => {
  if (!renderer.inTransition) governor.frame(dt);
  tickAuto();
});

/** Feed the phrase clock; on a boundary with auto on, change the look. */
function tickAuto(): void {
  const f = audio.getFrame();
  const boundary = phraseClock.update(nowSeconds(), f.beat, f.level, setSettings.phraseBars);
  if (boundary && setSettings.auto) {
    applyLook(lookSequence.next(currentLook, setSettings.order));
  }
}

// Mode selection lives on the performance bar (cycler + picker). The dock
// panel used to carry a second copy of the same buttons; one place is enough.

/** Refresh which controls the panel shows for the current mode + enabled passes. */
function refreshControls(): void {
  controlPanel.update(app.getMode(), isPassEnabled);
}

// Every registered mode, grouped for the picker; flattened, the same groups
// are the order the performance bar's cycler walks.
const MODE_GROUPS = groupModes([...MODES.map((m) => m.name), ...MODES_3D.map((m) => m.name)]);
const MODE_NAMES = modeOrder(MODE_GROUPS);

// How a set moves between pictures (crossfade length; auto looks later).
// Per machine, not a control — see setSettings.ts.
let setSettings = loadSet(storage);

/**
 * Begin a crossfade from whatever is showing, before anything changes. The
 * snapshot is the outgoing mode's values, which it keeps for the fade.
 */
function beginFade(): void {
  renderer.beginTransition(setSettings.fade, controlPanel.getValues());
}

// Phrase clock for auto looks. Any change the user makes restarts the count,
// so an automatic change never lands a moment after a manual one.
const phraseClock = new PhraseClock();
const lookSequence = new LookSequence(LOOKS.map((l) => l.name));
const nowSeconds = (): number => performance.now() / 1000;

// Assigned below; selectMode runs once before the bar exists.
let perfBar: PerformanceBar | null = null;

function selectMode(name: string, fade = true): void {
  if (fade && name !== app.getMode()) beginFade();
  phraseClock.restart(nowSeconds());
  app.setMode(name);
  governor.setMode(name);
  perfBar?.setMode(name);
  refreshControls();
}

// Highlight a default mode up front so the chip shows as selected on load.
if (MODES.length > 0) selectMode(MODES[0].name, false);

// --- Theme ------------------------------------------------------------------
// One selector re-tints the whole instrument: picking a theme writes its three
// colours into the store, and every mode blends toward them by Tint. Listening
// on the control (rather than on the widget) means hotkeys, MIDI and preset
// recall all land here too — one path, whatever moved the value.
const hotkeys = new Hotkeys();

// Reaction patterns write Feed/Kill the same way themes write colours.
controlPanel.onChange('uRdPattern', (v) => {
  if (typeof v === 'number') controlPanel.applyValues(patternValues(v));
});

controlPanel.onChange('uTheme', (v) => {
  if (typeof v !== 'number') return;
  controlPanel.applyValues(themeValues(v));
  perfBar?.setTheme(v);
});

THEMES.forEach((theme, i) => {
  hotkeys.bind(`Digit${i + 1}`, `Theme: ${theme.name}`, () => {
    controlPanel.applyValues({ uTheme: i });
  });
});

// Post-pass effect toggles. Each registered pass is a toggle button writing
// its uFx* control value — the single home for pass-enable state, which the
// Renderer reads per frame. Effects start off (toggle default false), so the
// pipeline is a no-op until one is switched on.
const fxButtons: Record<string, HTMLButtonElement> = {};
if (renderer.passNames.length > 0) {
  const fxSection = document.createElement('div');
  fxSection.className = 'section';
  fxSection.innerHTML = '<h2>Effects</h2>';
  const fxRow = document.createElement('div');
  fxRow.className = 'btn-row';
  for (const name of renderer.passNames) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      const on = !isPassEnabled(name);
      controlPanel.setValue(passToggleUniform(name), on ? 1 : 0);
      btn.classList.toggle('active', on);
      refreshControls();
    });
    fxButtons[name] = btn;
    fxRow.appendChild(btn);
  }
  fxSection.appendChild(fxRow);
  panel.appendChild(fxSection);
}

/** Repaint the Effects row from the control store (after a preset recall). */
function repaintFxButtons(): void {
  for (const [name, btn] of Object.entries(fxButtons)) {
    btn.classList.toggle('active', isPassEnabled(name));
  }
}

// --- Logo upload ------------------------------------------------------------
// Rasterise an uploaded image (SVG/PNG/JPEG/WebP) to a capped canvas and hand
// it to the Renderer's uLogo texture; the `logo` mode displaces it on audio.
{
  const logoSection = document.createElement('div');
  logoSection.className = 'section';
  logoSection.innerHTML = '<h2>Logo</h2>';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
  fileInput.style.display = 'none';
  fileInput.id = 'logo-file';
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'big-btn';
  uploadBtn.textContent = 'upload image';
  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    // onload rather than decode(): decode() never settles for blob URLs in
    // some embedded browsers, and onload is just as correct here.
    img.onload = () => {
      try {
        // Rasterise to a capped canvas: uniform path for raster + SVG (SVGs
        // without intrinsic size fall back to 512); alpha is preserved.
        const w = img.naturalWidth || 512;
        const h = img.naturalHeight || 512;
        const scale = Math.min(1, 1024 / Math.max(w, h));
        const cnv = document.createElement('canvas');
        cnv.width = Math.max(1, Math.round(w * scale));
        cnv.height = Math.max(1, Math.round(h * scale));
        cnv.getContext('2d')?.drawImage(img, 0, 0, cnv.width, cnv.height);
        renderer.setLogo(cnv);
        uploadBtn.textContent = file.name;
        selectMode('logo'); // make the upload instantly visible
      } catch (e) {
        reportError('logo', e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reportError('logo', `Could not decode "${file.name}" as an image.`);
    };
    img.src = url;
  });

  logoSection.append(uploadBtn, fileInput);
  panel.appendChild(logoSection);
}

// --- Presets ----------------------------------------------------------------
// Snapshot/recall of mode + all control values (pass toggles included) in
// localStorage, keyed by stable ControlDef ids.
// --- Built-in looks ---------------------------------------------------------
// Whole-instrument settings worth starting from. A look is applied onto a
// clean slate rather than onto whatever was on before: one that inherited
// leftover effects wouldn't be a look, it would be a suggestion.
let currentLook: string | null = null;

function applyLook(name: string): void {
  const look = findLook(name);
  if (!look) return;
  // Fade from the picture as it is now — before the look changes a value.
  beginFade();
  controlPanel.applyValues(defaultValues(allControls));
  controlPanel.applyValues(resolvePreset(look.preset, allControls));
  selectMode(look.preset.mode, false);
  repaintFxButtons();
  refreshControls();
  currentLook = name;
  perfBar?.setLook(name);
}

const presetStore = new PresetStore(window.localStorage);
const presetPanel = new PresetPanel(panel, {
  onSave: (name) => {
    // The user's own quality settings, not whatever the governor has stepped
    // down to right now.
    const values = governor.userValues(controlPanel.getValues());
    presetStore.save(name, snapshotPreset(app.getMode(), allControls, values));
    presetPanel.refresh(presetStore.list());
  },
  onLoad: (name) => {
    const preset = presetStore.load(name);
    if (!preset) return;
    beginFade();
    if (MODE_NAMES.includes(preset.mode)) selectMode(preset.mode, false);
    controlPanel.applyValues(resolvePreset(preset, allControls));
    repaintFxButtons();
    refreshControls();
    currentLook = null;
    perfBar?.setLook(null);
  },
  onDelete: (name) => {
    presetStore.remove(name);
    presetPanel.refresh(presetStore.list());
  },
  onLook: (name) => applyLook(name),
});
presetPanel.setLooks(LOOKS.map((l) => ({ name: l.name, note: l.note })));
presetPanel.refresh(presetStore.list());

// --- Set --------------------------------------------------------------------
const setPanel = new SetPanel(panel, setSettings, {
  onChange: (next) => {
    setSettings = next;
    saveSet(storage, next);
  },
});

// --- MIDI -------------------------------------------------------------------
// Hardware knobs/faders drive slider controls via MIDI-learn: pick a control,
// press learn, twist a knob. Bindings persist (stable ControlDef ids). The
// engine/mapping/persistence split lives in src/audio/midi.ts.
{
  const midiMap = new MidiMap(allControls);
  const midiStore = new MidiBindingStore(window.localStorage);
  midiMap.setAll(midiStore.load());

  const learnable = allControls.filter((d) => (d.type ?? 'slider') === 'slider');
  const byId = new Map(allControls.map((d) => [d.id, d]));
  const bindingChips = () =>
    midiMap.all.map((b) => ({
      controlId: b.controlId,
      text: `${byId.get(b.controlId)?.name ?? b.controlId} ← CC${b.controller} ch${b.channel + 1}`,
    }));

  // One handler for every CC, hardware or simulated: completes a pending
  // learn (and persists it), then routes the value into the control store.
  const handleCc = (ev: { channel: number; controller: number; value: number }): void => {
    const wasArmed = midiMap.armedControl !== null;
    const hit = midiMap.feed(ev);
    if (wasArmed && midiMap.armedControl === null) {
      midiStore.save(midiMap.all);
      midiPanel.setLearning(false);
      midiPanel.refreshBindings(bindingChips());
    }
    if (hit) controlPanel.applyValues({ [hit.glslName]: hit.value });
  };

  const midiPanel = new MidiPanel(
    panel,
    learnable.map((d) => ({ id: d.id, name: d.name })),
    {
      onConnect: () => {
        const engine = new MidiEngine();
        engine.onDevicesChanged((names) => {
          midiPanel.setStatus(
            names.length ? `inputs: ${names.join(', ')}` : 'no MIDI inputs — plug in a controller',
          );
        });
        engine.onCc(handleCc);
        midiPanel.setStatus('requesting MIDI access…');
        engine.init().catch((e: unknown) => {
          midiPanel.setStatus(e instanceof Error ? e.message : String(e));
        });
      },
      onLearn: (controlId) => midiMap.learn(controlId),
      onUnbind: (controlId) => {
        midiMap.unbind(controlId);
        midiStore.save(midiMap.all);
        midiPanel.refreshBindings(bindingChips());
      },
    },
  );
  midiPanel.setStatus(
    MidiEngine.supported ? 'press connect to use a controller' : 'Web MIDI not supported here',
  );
  midiPanel.refreshBindings(bindingChips());
}

// --- Output -----------------------------------------------------------------
// Performance output: fullscreen on the current display, or a Picture-in-
// Picture window (captureStream → hidden <video> → requestPictureInPicture)
// that can be dragged onto a second display while the controls stay here.
// The two actions are shared: the panel buttons and the performance bar both
// call them, and both repaint from the same `pipPainters` list, so the PiP
// state can never read differently in two places.
const pipPainters: ((on: boolean) => void)[] = [];
let pipVideo: HTMLVideoElement | null = null;

function paintPip(on: boolean): void {
  for (const paint of pipPainters) paint(on);
}

function goFullscreen(): void {
  stage.requestFullscreen().catch((e: unknown) => reportError('output', e));
}

function teardownPip(): void {
  if (!pipVideo) return;
  const stream = pipVideo.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  pipVideo.remove();
  pipVideo = null;
  paintPip(false);
}

async function togglePip(): Promise<void> {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return; // leavepictureinpicture handles teardown
    }
    if (!document.pictureInPictureEnabled) {
      reportError('output', 'Picture-in-Picture is not available in this browser.');
      return;
    }
    teardownPip(); // a previous request may still be pending — never stack videos
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    video.srcObject = stage.captureStream(60);
    document.body.appendChild(video);
    pipVideo = video;
    video.addEventListener('leavepictureinpicture', () => teardownPip());
    await video.play();
    await video.requestPictureInPicture();
    paintPip(true);
  } catch (e) {
    teardownPip();
    reportError('output', e);
  }
}

{
  const outSection = document.createElement('div');
  outSection.className = 'section';
  outSection.innerHTML = '<h2>Output</h2>';
  const outRow = document.createElement('div');
  outRow.className = 'btn-row';

  const fsBtn = document.createElement('button');
  fsBtn.textContent = 'fullscreen';
  fsBtn.addEventListener('click', () => goFullscreen());

  const pipBtn = document.createElement('button');
  pipBtn.textContent = 'pip window';
  pipBtn.addEventListener('click', () => void togglePip());
  pipPainters.push((on) => {
    pipBtn.classList.toggle('active', on);
    pipBtn.textContent = on ? 'close pip' : 'pip window';
  });

  const hint = document.createElement('div');
  hint.className = 'midi-status';
  hint.textContent = 'drag the PiP window to a second display for output';

  // Auto Quality: a machine preference, so it lives in localStorage rather
  // than in the control store (see loadAutoQuality).
  const autoBtn = document.createElement('button');
  const paintAuto = (on: boolean): void => {
    autoBtn.classList.toggle('active', on);
    autoBtn.textContent = on ? 'auto quality' : 'quality pinned';
    autoBtn.title = on
      ? 'Steps quality and resolution down when frames fall behind, and back up when they recover'
      : 'Quality stays exactly as set';
  };
  // Held here rather than re-read from storage, which may be unavailable.
  let autoOn = loadAutoQuality(storage);
  paintAuto(autoOn);
  autoBtn.addEventListener('click', () => {
    autoOn = !autoOn;
    saveAutoQuality(storage, autoOn);
    governor.setEnabled(autoOn);
    paintAuto(autoOn);
  });

  outRow.append(fsBtn, pipBtn, autoBtn);
  outSection.append(outRow, hint);
  panel.appendChild(outSection);
}

// --- Source picker --------------------------------------------------------
// The render loop runs from boot — visuals are always live, they just sit
// still until a source is feeding the analyser.
let audioEnabled = false;

// The loaded file is kept so the dropdown can switch back to it after a
// detour through the mic — the element itself is disposed on every swap
// (a MediaElementSourceNode is single-use), so the source is rebuilt.
let loadedFile: File | null = null;

/** Build and arm whatever the dropdown currently points at. Failures stay visible. */
async function activateSelected(): Promise<void> {
  const sel = picker.selection;
  if (sel.kind === 'file') {
    if (loadedFile) await playFile(loadedFile);
    return;
  }
  if (sel.kind !== 'device') {
    picker.setStatus('no audio inputs detected');
    return;
  }
  picker.setStatus(`${sel.label}: opening…`);
  try {
    const source = await createMicSource(audio.context, sel.deviceId);
    transport.detach(); // the outgoing file element is about to be disposed
    audio.setSource(source);
    picker.setStatus(`reacting to ${source.label}`);
    perfBar?.setSource('mic');
  } catch (e) {
    reportError(`source:device`, e);
    picker.setStatus(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Take a dropped/chosen audio file and make it the live source: decode it,
 * hand the element to the transport, start playing. No microphone permission
 * is involved — the click or drop is the gesture that unlocks the context.
 */
async function playFile(file: File): Promise<void> {
  picker.setStatus(`${file.name}: loading…`);
  try {
    await audio.resume();
    const source = await createFileSource(audio.context, file);
    transport.detach();
    audio.setSource(source); // disposes the previous source
    loadedFile = file;
    picker.setFile(file.name);
    picker.selectFile();
    transport.attach(source.media, file.name);
    await source.media.play();
    picker.setStatus(`playing ${file.name}`);
    perfBar?.setSource('file');
  } catch (e) {
    reportError('source:file', e);
    picker.setStatus(e instanceof Error ? e.message : String(e));
  }
}

// The one required gesture: resume the AudioContext, request permission so
// device labels appear, enumerate, then auto-arm the first input.
async function enableAudio(): Promise<void> {
  picker.setStatus('requesting audio permission…');
  try {
    await audio.resume();
    await requestAudioPermission();
    audioEnabled = true;
    picker.markAudioEnabled();
    const list = await listAudioInputs();
    picker.setDevices(list);
    if (list.length > 0) {
      await activateSelected();
    } else {
      picker.setStatus('no audio inputs detected — connect a device');
    }
  } catch (e) {
    reportError('devices', e);
    picker.setStatus(e instanceof Error ? e.message : String(e));
  }
}

const picker = new SourcePicker(panel, {
  onEnableAudio: () => {
    void enableAudio();
  },
  onSelectSource: () => {
    void activateSelected();
  },
});

// --- File playback ----------------------------------------------------------
// A second way in: play a track instead of listening to the room. Load it from
// the panel or drop it anywhere on the stage; Space plays/pauses.
const transport = new Transport(panel, {
  onFile: (file) => {
    void playFile(file);
  },
});

// Drop anywhere — the whole window is the target, with a hint over the stage.
{
  const hint = document.createElement('div');
  hint.id = 'drop-hint';
  hint.textContent = 'drop an audio file to play it';
  document.body.appendChild(hint);

  // dragenter/dragleave fire per element crossed, so count them rather than
  // trusting a single leave to mean "the pointer left the window".
  let depth = 0;
  const hide = (): void => {
    depth = 0;
    hint.classList.remove('visible');
  };

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    hint.classList.add('visible');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (--depth <= 0) hide();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    hide();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    const audioFile = pickAudioFile(files);
    if (!audioFile) {
      reportWarning('source:file', `"${files[0].name}" is not an audio file.`);
      return;
    }
    void playFile(audioFile);
  });
}

// Space = play/pause the loaded file (the hotkey seam stands down for
// whatever is focused — see isTypingTarget).
hotkeys.bind('Space', 'Play / pause the loaded file', () => transport.toggle());

// --- Performance bar --------------------------------------------------------
// The handful of controls you actually touch mid-set, floating over the visual
// and fading out when the mouse goes still. Every one of them is a second view
// of something the dock panel already owns — never a second source of truth.
perfBar = new PerformanceBar(document.body, THEMES, {
  onMic: () => {
    if (!audioEnabled) {
      void enableAudio();
      return;
    }
    picker.selectFirstDevice();
    void activateSelected();
  },
  onFile: () => {
    if (loadedFile) void playFile(loadedFile);
    else transport.openFilePicker();
  },
  onPlayPause: () => transport.toggle(),
  onTheme: (i) => controlPanel.applyValues({ uTheme: i }),
  onPickMode: (name) => selectMode(name),
  onCycleMode: (step) => {
    const next = stepIndex(MODE_NAMES.indexOf(app.getMode()), step, MODE_NAMES.length);
    selectMode(MODE_NAMES[next]);
  },
  onAuto: () => toggleAuto(),
  onCycleLook: () => {
    const i = currentLook ? LOOKS.findIndex((l) => l.name === currentLook) : -1;
    applyLook(LOOKS[stepIndex(i, 1, LOOKS.length)].name);
  },
  onFullscreen: () => goFullscreen(),
  onPip: () => void togglePip(),
});
perfBar.setModes(MODE_GROUPS);
perfBar.setAuto(setSettings.auto);

/** Auto looks on/off — from the bar or key A. Starts a fresh phrase count. */
function toggleAuto(): void {
  setSettings = { ...setSettings, auto: !setSettings.auto };
  saveSet(storage, setSettings);
  setPanel.set(setSettings);
  phraseClock.restart(nowSeconds());
  perfBar?.setAuto(setSettings.auto, phraseClock.measured ? phraseClock.bpm : undefined);
}
hotkeys.bind('KeyA', 'Auto looks on / off', () => toggleAuto());
// Keep the tempo in the auto button's tooltip roughly current.
window.setInterval(
  () => perfBar?.setAuto(setSettings.auto, phraseClock.measured ? phraseClock.bpm : undefined),
  2000,
);
perfBar.setMode(app.getMode());
perfBar.setTheme(controlPanel.getValue('uTheme'));
transport.watch((s) => perfBar?.setTransport(s));
pipPainters.push((on) => perfBar?.setPip(on));

// Keep the device list fresh as hardware comes and goes (controller plugged
// in, BlackHole installed/removed) — no manual rescan needed.
onDeviceChange(() => {
  if (!audioEnabled) return;
  void listAudioInputs()
    .then((list) => picker.setDevices(list))
    .catch((e) => reportError('devices', e));
});

// --- Resize + shader HMR --------------------------------------------------
window.addEventListener('resize', () => renderer.resize());
renderer.resize();

// Start the always-on render loop.
app.start();

onModesChanged((modes) => {
  for (const mode of modes) renderer.registerMode(mode);
  // Keep the current mode pointed at its freshly compiled program.
  if (app.getMode()) renderer.setMode(app.getMode());
});

onPassesChanged((passes) => {
  for (const pass of passes) renderer.registerPass(pass);
});
