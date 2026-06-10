/**
 * Off-screen render targets for the post-pass pipeline. Each Fbo is a colour
 * texture (RGBA16F where renderable, RGBA8 fallback — see `detectFboFormat`)
 * with a framebuffer bound to it; the Renderer draws a mode into one, then runs
 * the pass chain across a ping-pong pair, sampling these textures as `uSource` /
 * `uPrevFrame`. Single-sample, LINEAR/CLAMP — enough for the 2D fullscreen
 * passes; no depth/stencil attachment (we never depth-test). Half-float linear
 * filtering is core WebGL2, so LINEAR needs no extension on the 16F path.
 */
export interface FboFormat {
  internalFormat: number; // gl.RGBA16F or gl.RGBA8
  format: number; // always gl.RGBA
  type: number; // gl.HALF_FLOAT or gl.UNSIGNED_BYTE
}

export interface Fbo {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  fmt: FboFormat;
}

/**
 * Pick the best colour-renderable format for the pipeline's render targets.
 * RGBA16F (HDR — bloom/trails can accumulate past 1.0) when an extension makes
 * it renderable: EXT_color_buffer_float, or EXT_color_buffer_half_float on
 * 16F-only devices. getExtension() both queries and enables. A probe FBO must
 * also report FRAMEBUFFER_COMPLETE — belt and braces over the extension flag.
 * Otherwise RGBA8 (LDR), which every WebGL2 context supports.
 */
export function detectFboFormat(gl: WebGL2RenderingContext): FboFormat {
  const ldr: FboFormat = { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
  const ext =
    gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float');
  if (!ext) return ldr;

  const hdr: FboFormat = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
  try {
    const probe = createFbo(gl, 4, 4, hdr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe.framebuffer);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    deleteFbo(gl, probe);
    return complete ? hdr : ldr;
  } catch {
    return ldr;
  }
}

/** Allocate an Fbo sized w×h. Throws on GL allocation failure (caller reports). */
export function createFbo(gl: WebGL2RenderingContext, w: number, h: number, fmt: FboFormat): Fbo {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    throw new Error('Failed to allocate framebuffer object.');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, fmt.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, width: w, height: h, fmt };
}

/** Reallocate the colour texture if the target size changed. No-op otherwise. */
export function resizeFbo(gl: WebGL2RenderingContext, fbo: Fbo, w: number, h: number): void {
  if (fbo.width === w && fbo.height === h) return;
  const { internalFormat, format, type } = fbo.fmt;
  gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  fbo.width = w;
  fbo.height = h;
}

export function deleteFbo(gl: WebGL2RenderingContext, fbo: Fbo): void {
  gl.deleteFramebuffer(fbo.framebuffer);
  gl.deleteTexture(fbo.texture);
}
