/**
 * Minimal column-major mat4 builders for custom 3D modes — the entire camera
 * "library" the raw-WebGL2 path needs (see the Phase 4 spike / decision).
 * Layouts match WebGL's uniformMatrix4fv expectations.
 */

export type Vec3 = [number, number, number];

/** Right-handed perspective projection (fovY in radians). */
export function perspective(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** View matrix looking from `eye` at `target` (right-handed, +Y up). */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Float32Array {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  // prettier-ignore
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

/** A world point as it lands on screen: uv in 0..1 (origin bottom-left), and w (view depth). */
export interface ScreenPoint {
  u: number;
  v: number;
  w: number;
}

/**
 * Project a world point through `proj * view` to screen uv. Returns null for a
 * point behind the camera, where the divide by w would flip it back onto the
 * screen mirrored — a background pass drawing light at that spot would show a
 * core that isn't there.
 */
export function project(proj: Float32Array, view: Float32Array, p: Vec3): ScreenPoint | null {
  const mul = (m: Float32Array, x: number, y: number, z: number, wIn: number) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * wIn,
    m[1] * x + m[5] * y + m[9] * z + m[13] * wIn,
    m[2] * x + m[6] * y + m[10] * z + m[14] * wIn,
    m[3] * x + m[7] * y + m[11] * z + m[15] * wIn,
  ];
  const [vx, vy, vz, vw] = mul(view, p[0], p[1], p[2], 1);
  const [cx, cy, , cw] = mul(proj, vx, vy, vz, vw);
  if (cw <= 1e-4) return null;
  return { u: (cx / cw) * 0.5 + 0.5, v: (cy / cw) * 0.5 + 0.5, w: cw };
}
