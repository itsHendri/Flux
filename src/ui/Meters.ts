import type { AudioFrame } from '../core/state.ts';

interface MeterRow {
  key: keyof AudioFrame;
  fill: HTMLElement;
}

/** Bass / mid / high / level bars, refreshed every frame from the audio snapshot. */
export class Meters {
  private readonly rows: MeterRow[] = [];

  constructor(parent: HTMLElement) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Levels</h2>';

    const meters = document.createElement('div');
    meters.className = 'meters';

    const defs: Array<{ key: keyof AudioFrame; label: string }> = [
      { key: 'bass', label: 'BASS' },
      { key: 'mid', label: 'MID' },
      { key: 'high', label: 'HIGH' },
      { key: 'level', label: 'LVL' },
    ];

    for (const d of defs) {
      const row = document.createElement('div');
      row.className = `meter ${d.key}`;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = d.label;

      const track = document.createElement('div');
      track.className = 'track';
      const fill = document.createElement('div');
      fill.className = 'fill';
      track.appendChild(fill);

      row.append(name, track);
      meters.appendChild(row);
      this.rows.push({ key: d.key, fill });
    }

    section.appendChild(meters);
    parent.appendChild(section);
  }

  /** Called once per frame from the App loop. */
  update(frame: AudioFrame): void {
    for (const row of this.rows) {
      const v = Math.max(0, Math.min(1, frame[row.key]));
      row.fill.style.width = `${(v * 100).toFixed(1)}%`;
    }
  }
}
