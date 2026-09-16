import type { FrameState } from './core/state.ts';
import { AudioEngine } from './audio/AudioEngine.ts';
import { Renderer } from './render/Renderer.ts';
import { ControlPanel } from './ui/ControlPanel.ts';

/**
 * The orchestrator. Owns the single requestAnimationFrame loop: ticks the
 * AudioEngine, assembles an immutable FrameState, and hands it to the
 * Renderer. Nothing else owns timing.
 */
export class App {
  private running = false;
  private startTime = 0;
  private lastTime = 0;
  private rafId = 0;
  private mode = '';

  constructor(
    private readonly audio: AudioEngine,
    private readonly renderer: Renderer,
    private readonly controls: ControlPanel,
  ) {}

  setMode(name: string): void {
    this.mode = name;
    this.renderer.setMode(name);
  }

  getMode(): string {
    return this.mode;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly loop = (now: number): void => {
    if (!this.running) return;

    // Real dt — clamped so a stalled tab doesn't produce a huge jump.
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const audioFrame = this.audio.tick(dt);
    this.renderer.resize();

    const state: FrameState = {
      time: (now - this.startTime) / 1000,
      dt,
      resolution: this.renderer.resolution,
      audio: audioFrame,
      audioTexture: this.audio.textureData,
      controls: this.controls.getValues(),
      mode: this.mode,
    };

    this.renderer.render(state);

    this.rafId = requestAnimationFrame(this.loop);
  };
}
