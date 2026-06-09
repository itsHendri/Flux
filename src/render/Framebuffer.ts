/**
 * Off-screen render targets for the post-pass pipeline. Each Fbo is an RGBA8
 * colour texture with a framebuffer bound to it; the Renderer draws a mode into
 * one, then runs the pass chain across a ping-pong pair, sampling these textures
 * as `uSource` / `uPrevFrame`. Single-sample, LINEAR/CLAMP — enough for the 2D
 * fullscreen passes; no depth/stencil attachment (we never depth-test).
 */
export interface Fbo {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

/** Allocate an Fbo sized w×h. Throws on GL allocation failure (caller reports). */
export function createFbo(gl: WebGL2RenderingContext, w: number, h: number): Fbo {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    throw new Error('Failed to allocate framebuffer object.');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, width: w, height: h };
}

/** Reallocate the colour texture if the target size changed. No-op otherwise. */
export function resizeFbo(gl: WebGL2RenderingContext, fbo: Fbo, w: number, h: number): void {
  if (fbo.width === w && fbo.height === h) return;
  gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  fbo.width = w;
  fbo.height = h;
}

export function deleteFbo(gl: WebGL2RenderingContext, fbo: Fbo): void {
  gl.deleteFramebuffer(fbo.framebuffer);
  gl.deleteTexture(fbo.texture);
}
