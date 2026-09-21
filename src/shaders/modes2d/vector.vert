#version 300 es
// VECTOR beam — one quad per segment between consecutive stereo samples.
//
// woscope's construction (m1el, github.com/m1el/woscope, MIT): the beam is
// drawn segment by segment, each as a quad padded by a few beam-widths on
// every side, and the fragment shader integrates a Gaussian spot along the
// segment. A quad per segment rather than a line strip because GL lines are one
// pixel wide and have no falloff — a beam is a soft spot, not a line.
//
// No vertex buffers: the segment is gl_InstanceID, the corner gl_VertexID.

uniform highp sampler2D uStereo;
uniform vec2 uResolution;
uniform float uScopeView;   // 0 = X/Y (L across, R up), 1 = mid/side
uniform float uScopeZoom;
uniform float uScopeBeam;
uniform float uAutoGain;    // CPU-side 1/peak, smoothed

out vec2 vLocal;   // fragment position in segment space (pixels): x along, y across
out float vLen;    // segment length in pixels
out float vSigma;  // beam radius in pixels

vec2 plot(int i) {
  vec2 lr = vec2(texelFetch(uStereo, ivec2(i, 0), 0).r, texelFetch(uStereo, ivec2(i, 1), 0).r);
  vec2 p = uScopeView < 0.5
    ? lr
    // Goniometer convention: mono stands straight up, hard left leans up-left.
    // Halved rather than the rotation's 1/√2, so full-scale mono still fits
    // the height instead of running off the top.
    : vec2(lr.y - lr.x, lr.x + lr.y) * 0.5;
  return p * uAutoGain * uScopeZoom * 0.8;
}

void main() {
  int i = gl_InstanceID;
  float scale = min(uResolution.x, uResolution.y) * 0.5;
  vec2 a = plot(i) * scale;
  vec2 b = plot(i + 1) * scale;

  vSigma = max(0.6, uScopeBeam * scale * 0.004);
  float pad = vSigma * 4.0;
  vec2 d = b - a;
  vLen = length(d);
  vec2 dir = vLen > 1e-4 ? d / vLen : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // Corners 0..3 as a strip: (start, -), (start, +), (end, -), (end, +).
  float along = (gl_VertexID & 2) == 0 ? -pad : vLen + pad;
  float across = (gl_VertexID & 1) == 0 ? -pad : pad;
  vec2 px = a + dir * along + nrm * across;
  vLocal = vec2(along, across);

  gl_Position = vec4(px / (uResolution * 0.5), 0.0, 1.0);
}
