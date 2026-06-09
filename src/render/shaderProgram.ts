/** Result of a compile/link attempt — either a usable program or a log string. */
export type ProgramResult =
  | { ok: true; program: WebGLProgram }
  | { ok: false; log: string };

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): { ok: true; shader: WebGLShader } | { ok: false; log: string } {
  const shader = gl.createShader(type);
  if (!shader) return { ok: false, log: 'gl.createShader returned null' };
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    return { ok: false, log };
  }
  return { ok: true, shader };
}

/** Compile + link a program. Never throws — failures come back as a log. */
export function buildProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string,
): ProgramResult {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  if (!vert.ok) return { ok: false, log: `vertex shader:\n${vert.log}` };

  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!frag.ok) {
    gl.deleteShader(vert.shader);
    return { ok: false, log: `fragment shader:\n${frag.log}` };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert.shader);
    gl.deleteShader(frag.shader);
    return { ok: false, log: 'gl.createProgram returned null' };
  }
  gl.attachShader(program, vert.shader);
  gl.attachShader(program, frag.shader);
  gl.linkProgram(program);
  // Shaders can be deleted once linked.
  gl.deleteShader(vert.shader);
  gl.deleteShader(frag.shader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    return { ok: false, log: `link:\n${log}` };
  }
  return { ok: true, program };
}
