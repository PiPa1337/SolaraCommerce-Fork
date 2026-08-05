import { useEffect, useRef } from "react";

const vertexSource = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
out vec4 color;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float drift = time * 0.055;
  float ring = exp(-pow((radius - 0.72 - sin(angle * 2.0 + drift) * 0.025) * 13.0, 2.0));
  float inner = exp(-pow(radius * 6.0, 2.0));
  float swirl = exp(-pow((radius - 0.53 + sin(angle * 3.0 - drift) * 0.045) * 10.0, 2.0));
  float stars = step(0.9974, hash21(floor(uv * 22.0 + time * 0.02)));
  vec3 base = vec3(0.004, 0.006, 0.012);
  vec3 amber = vec3(1.0, 0.43, 0.075);
  vec3 violet = vec3(0.24, 0.09, 0.29);
  vec3 glow = amber * (ring * 0.28 + swirl * 0.08) + violet * (0.12 * exp(-radius * 1.5));
  glow += vec3(1.0, 0.7, 0.22) * stars * 0.38;
  glow *= smoothstep(1.65, 0.05, radius);
  glow *= 1.0 - inner * 0.8;
  color = vec4(base + glow, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("No se pudo crear el shader Cosmic.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Shader inválido.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("No se pudo crear el programa Cosmic.");
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Programa WebGL inválido.";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export function CosmicBackground({ intensity = "normal" }: { intensity?: "subtle" | "normal" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      canvas.dataset.webgl = "fallback";
      return;
    }
    const activateProgram = gl.useProgram.bind(gl);

    let program: WebGLProgram | undefined;
    let buffer: WebGLBuffer | undefined;
    let frame = 0;
    let lastFrame = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    let destroyed = false;

    try {
      program = createProgram(gl);
      buffer = gl.createBuffer() ?? undefined;
      if (!buffer) throw new Error("No se pudo crear el buffer Cosmic.");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      activateProgram(program);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      canvas.dataset.webgl = "ready";
    } catch {
      canvas.dataset.webgl = "fallback";
      return () => {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
      };
    }

    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    visibilityObserver.observe(canvas);

    const render = (timestamp: number) => {
      if (destroyed) return;
      if (visible && pageVisible && (reducedMotion.matches || timestamp - lastFrame >= 33)) {
        lastFrame = timestamp;
        activateProgram(program);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(time, reducedMotion.matches ? 0 : timestamp * 0.001);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (!reducedMotion.matches) frame = requestAnimationFrame(render);
    };
    const onMotionChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible && !reducedMotion.matches) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
      }
    };
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      visibilityObserver.disconnect();
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <div className={`cosmic-background cosmic-background--${intensity}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
