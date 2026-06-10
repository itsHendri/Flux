import './styles.css';
import { App } from './App.ts';
import { installGlobalErrorHooks, reportError, clearErrors } from './core/errors.ts';
import { AudioEngine } from './audio/AudioEngine.ts';
import { Renderer } from './render/Renderer.ts';
import { createMicSource } from './audio/sources.ts';
import {
  listAudioInputs,
  onDeviceChange,
  requestAudioPermission,
} from './audio/devices.ts';
import { CONTROLS } from './ui/controls.ts';
import { passToggleDefs, passToggleUniform } from './core/state.ts';
import { MODES, onModesChanged } from './shaders/modes.ts';
import { PASSES, onPassesChanged } from './shaders/passes.ts';
import { ControlPanel } from './ui/ControlPanel.ts';
import { Meters } from './ui/Meters.ts';
import { SourcePicker } from './ui/SourcePicker.ts';
import { PresetPanel } from './ui/PresetPanel.ts';
import { PresetStore, snapshotPreset, resolvePreset } from './presets/presets.ts';

installGlobalErrorHooks();

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const panel = document.getElementById('panel');
if (!canvas || !panel) {
  reportError('boot', 'Missing #stage canvas or #panel element in index.html.');
  throw new Error('boot: missing DOM elements');
}

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
const allControls = [...CONTROLS, ...passToggles];

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
for (const pass of PASSES) renderer.registerPass(pass);

// --- Audio ----------------------------------------------------------------
const audio = new AudioEngine({ fftSize: 2048 });

// --- UI -------------------------------------------------------------------
// The pass toggles are widgetless here — the Effects button row below is
// their UI, writing through setValue into the same store.
const controlPanel = new ControlPanel(panel, CONTROLS, passToggles);
const meters = new Meters(panel);

const isPassEnabled = (name: string): boolean =>
  controlPanel.getValue(passToggleUniform(name)) >= 0.5;

const app = new App(audio, renderer, controlPanel, meters);

// Shader mode switcher.
const modeSection = document.createElement('div');
modeSection.className = 'section';
modeSection.innerHTML = '<h2>Mode</h2>';
const modeRow = document.createElement('div');
modeRow.className = 'btn-row';
const modeButtons: Record<string, HTMLButtonElement> = {};
for (const mode of MODES) {
  const btn = document.createElement('button');
  btn.textContent = mode.name;
  btn.addEventListener('click', () => selectMode(mode.name));
  modeButtons[mode.name] = btn;
  modeRow.appendChild(btn);
}
modeSection.appendChild(modeRow);
panel.appendChild(modeSection);

/** Refresh which controls the panel shows for the current mode + enabled passes. */
function refreshControls(): void {
  controlPanel.update(app.getMode(), isPassEnabled);
}

function selectMode(name: string): void {
  app.setMode(name);
  for (const [n, btn] of Object.entries(modeButtons)) {
    btn.classList.toggle('active', n === name);
  }
  refreshControls();
}

// Highlight a default mode up front so the chip shows as selected on load.
if (MODES.length > 0) selectMode(MODES[0].name);

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

// --- Presets ----------------------------------------------------------------
// Snapshot/recall of mode + all control values (pass toggles included) in
// localStorage, keyed by stable ControlDef ids.
const presetStore = new PresetStore(window.localStorage);
const presetPanel = new PresetPanel(panel, {
  onSave: (name) => {
    presetStore.save(name, snapshotPreset(app.getMode(), allControls, controlPanel.getValues()));
    presetPanel.refresh(presetStore.list());
  },
  onLoad: (name) => {
    const preset = presetStore.load(name);
    if (!preset) return;
    if (MODES.some((m) => m.name === preset.mode)) selectMode(preset.mode);
    controlPanel.applyValues(resolvePreset(preset, allControls));
    repaintFxButtons();
    refreshControls();
  },
  onDelete: (name) => {
    presetStore.remove(name);
    presetPanel.refresh(presetStore.list());
  },
});
presetPanel.refresh(presetStore.list());

// --- Source picker --------------------------------------------------------
// The render loop runs from boot — visuals are always live, they just sit
// still until a source is feeding the analyser.
let audioEnabled = false;

/** Build and arm the currently selected device. Failures stay visible. */
async function activateSelected(): Promise<void> {
  const sel = picker.selection;
  if (sel.kind !== 'device') {
    picker.setStatus('no audio inputs detected');
    return;
  }
  picker.setStatus(`${sel.label}: opening…`);
  try {
    const source = await createMicSource(audio.context, sel.deviceId);
    audio.setSource(source);
    picker.setStatus(`reacting to ${source.label}`);
  } catch (e) {
    reportError(`source:device`, e);
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
