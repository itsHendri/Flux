// SPECTROGRAM write — one column of history per tick.
//
// The whole mode is this: the spectrum FLUX already computes, stamped into a
// ring buffer one column at a time. The draw pass then reads that buffer as a
// picture of the recent past. Only the single column being written is
// rasterised (the viewport is one pixel wide), so the cost is a column, not a
// frame.
in vec2 vUv;
out vec4 outColor;

void main() {
  // vUv.y runs bottom to top of the column = low to high frequency, on the
  // same log axis the bars use, so an octave occupies constant height.
  float mag = spectrumLog(vUv.y);
  outColor = vec4(mag, mag, mag, 1.0);
}
