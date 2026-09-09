import { useEffect, useRef } from "react";
import { GRAVITY_FRAGMENT_SHADER } from "./gravity-cinematic-shader";
import { createGravityDustTexture } from "./gravity-dust-texture";

interface GravityFieldProps {
  activeIndex: number;
  storeCount: number;
  selectionVisible?: boolean;
  templateSelected?: boolean;
  launchProgress?: number;
  introDurationMs?: number;
  pauseWhileAppBooting?: boolean;
  renderScaleMultiplier?: number;
}

interface GravityPointer {
  x: number;
  y: number;
}

// Gargantua conserva una respuesta sutil: queda en el 30% del movimiento
// anterior para que el fondo no domine la interacción del dashboard.
const GRAVITY_PARALLAX_RESPONSE = 0.09;
const GRAVITY_SETTLED_ELAPSED_MS = 6000;

interface GravityWebGLScene {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  dust: WebGLTexture;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    viewport: WebGLUniformLocation | null;
    dust: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    introDuration: WebGLUniformLocation | null;
    pointer: WebGLUniformLocation | null;
    center: WebGLUniformLocation | null;
    disk: WebGLUniformLocation | null;
    activeIndex: WebGLUniformLocation | null;
    storeCount: WebGLUniformLocation | null;
    selectionVisible: WebGLUniformLocation | null;
    templateSelected: WebGLUniformLocation | null;
    launchProgress: WebGLUniformLocation | null;
  };
}

const GRAVITY_VERTEX_SHADER = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function compileGravityShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createGravityWebGLScene(canvas: HTMLCanvasElement): GravityWebGLScene | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vertexShader = compileGravityShader(gl, gl.VERTEX_SHADER, GRAVITY_VERTEX_SHADER);
  const fragmentShader = compileGravityShader(gl, gl.FRAGMENT_SHADER, GRAVITY_FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const vertexArray = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vertexArray || !buffer) {
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (buffer) gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 1);
  const dust = createGravityDustTexture(gl);
  if (!dust) {
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vertexArray);
    gl.deleteProgram(program);
    return null;
  }

  return {
    gl,
    program,
    vertexArray,
    buffer,
    dust,
    uniforms: {
      resolution: gl.getUniformLocation(program, "uResolution"),
      viewport: gl.getUniformLocation(program, "uViewport"),
      dust: gl.getUniformLocation(program, "uDust"),
      time: gl.getUniformLocation(program, "uTime"),
      introDuration: gl.getUniformLocation(program, "uIntroDuration"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      center: gl.getUniformLocation(program, "uCenter"),
      disk: gl.getUniformLocation(program, "uDisk"),
      activeIndex: gl.getUniformLocation(program, "uActiveIndex"),
      storeCount: gl.getUniformLocation(program, "uStoreCount"),
      selectionVisible: gl.getUniformLocation(program, "uSelectionVisible"),
      templateSelected: gl.getUniformLocation(program, "uTemplateSelected"),
      launchProgress: gl.getUniformLocation(program, "uLaunchProgress"),
    },
  };
}

function destroyGravityWebGLScene(scene: GravityWebGLScene) {
  scene.gl.deleteTexture(scene.dust);
  scene.gl.deleteBuffer(scene.buffer);
  scene.gl.deleteVertexArray(scene.vertexArray);
  scene.gl.deleteProgram(scene.program);
}

function drawGravityWebGL(
  scene: GravityWebGLScene,
  width: number,
  height: number,
  time: number,
  introDurationMs: number,
  pointer: GravityPointer,
  activeIndex: number,
  storeCount: number,
  selectionVisible: boolean,
  templateSelected: boolean,
  launchProgress: number,
) {
  const { gl, program, vertexArray, uniforms } = scene;
  const wideScene = width >= 1120;
  const tabletScene = width >= 700;
  const compactness = Math.min(1, Math.max(0.72, width / 1320));
  const parallaxPointer = {
    x: 0.5 + (pointer.x - 0.5) * GRAVITY_PARALLAX_RESPONSE,
    y: 0.35 + (pointer.y - 0.35) * GRAVITY_PARALLAX_RESPONSE,
  };
  const centerXBase = wideScene ? 0.724 : tabletScene ? 0.7 : 0.72;
  const centerYBase = wideScene ? 0.49 : tabletScene ? 0.49 : 0.35;
  const centerX = width * (centerXBase + (parallaxPointer.x - 0.5) * 0.035);
  const centerY = height * (centerYBase + (parallaxPointer.y - 0.35) * 0.045);
  const aspect = width / Math.max(height, 1);
  // La referencia trabaja con un horizonte enorme y un disco que atraviesa
  // gran parte del encuadre; se conserva el margen lateral para que la UI
  // siga teniendo aire en desktop y en tablet.
  const diskWidth = Math.min(width * (wideScene ? 0.5 : 0.78), height * 0.56) * compactness;
  const diskHeight = Math.max(68, diskWidth * 0.32);

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // WebGL's useProgram is an imperative GPU call, not a React hook.
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);
  gl.uniform2f(uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform2f(uniforms.viewport, width, height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, scene.dust);
  gl.uniform1i(uniforms.dust, 0);
  gl.uniform1f(uniforms.time, time);
  gl.uniform1f(uniforms.introDuration, introDurationMs);
  gl.uniform2f(uniforms.pointer, parallaxPointer.x, parallaxPointer.y);
  gl.uniform2f(uniforms.center, (centerX / width - 0.5) * aspect, 0.5 - centerY / height);
  gl.uniform2f(uniforms.disk, diskWidth / height, diskHeight / height);
  gl.uniform1f(uniforms.activeIndex, activeIndex);
  gl.uniform1f(uniforms.storeCount, Math.min(12, Math.max(0, storeCount)));
  gl.uniform1f(uniforms.selectionVisible, selectionVisible ? 1 : 0);
  gl.uniform1f(uniforms.templateSelected, templateSelected ? 1 : 0);
  gl.uniform1f(uniforms.launchProgress, Math.min(1, Math.max(0, launchProgress)));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export function GravityField({
  activeIndex,
  storeCount,
  selectionVisible = true,
  templateSelected = false,
  launchProgress = 0,
  introDurationMs = 6000,
  pauseWhileAppBooting = true,
  renderScaleMultiplier = 1,
}: GravityFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<GravityPointer>({ x: 0.5, y: 0.35 });
  const activeIndexRef = useRef(activeIndex);
  const storeCountRef = useRef(storeCount);
  const selectionVisibleRef = useRef(selectionVisible);
  const templateSelectedRef = useRef(templateSelected);
  const launchProgressRef = useRef(launchProgress);
  const redrawRef = useRef<(() => void) | null>(null);
  activeIndexRef.current = activeIndex;
  storeCountRef.current = storeCount;
  selectionVisibleRef.current = selectionVisible;
  templateSelectedRef.current = templateSelected;
  launchProgressRef.current = launchProgress;

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    const root = field?.closest<HTMLElement>(".app-root--dashboard-cosmic") ?? field?.parentElement;
    if (!field || !canvas || !root) return;

    const initialScene = createGravityWebGLScene(canvas);
    field.dataset.renderer = initialScene ? "webgl2" : "unavailable";
    if (!initialScene) return;
    let scene = initialScene;
    let contextLost = false;

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionMedia.matches;
    let width = 0;
    let height = 0;
    let devicePixelRatio = 1;
    let frame: number | undefined;
    let lastDrawAt = 0;
    let measuredFrames = 0;
    let slowFrames = 0;
    // Start below native resolution while the boot also loads the local library.
    let adaptiveScale = reducedMotion ? 1 : 0.78;
    let targetScale = adaptiveScale;
    let lastQualityStepAt = 0;
    let hiddenAt: number | undefined;
    const smoothPointer = { ...pointerRef.current };
    let qualityWindowStartedAt = 0;
    let gpuFrames: WebGLSync[] = [];
    let nextDrawAt = 0;
    let rootLeft = 0;
    let rootTop = 0;
    let rootWidth = 1;
    let rootHeight = 1;
    const bootStateAtMount = document.documentElement.dataset.solaraBoot;
    const settleSceneAtMount = pauseWhileAppBooting && bootStateAtMount === "entering";
    let sceneStartedAt = performance.now() - (settleSceneAtMount ? GRAVITY_SETTLED_ELAPSED_MS : 0);
    const appBootOverlayMountedBeforeMarker =
      pauseWhileAppBooting &&
      document.documentElement.dataset.solaraBoot === undefined &&
      document.querySelector(".app-boot-sequence") !== null;
    const isAppBooting = () =>
      pauseWhileAppBooting && document.documentElement.dataset.solaraBoot === "loading";
    // The overlay and dashboard mount in the same commit. The one-time DOM
    // fallback closes that first-effect race before the overlay writes its dataset.
    let appBootPaused = isAppBooting() || appBootOverlayMountedBeforeMarker;

    const draw = (time: number) => {
      if (appBootPaused || contextLost) return;
      if (!reducedMotion && gpuFrames.length >= 2) return;
      const elapsed = Math.max(0, time - sceneStartedAt);
      smoothPointer.x += (pointerRef.current.x-smoothPointer.x)*.065;
      smoothPointer.y += (pointerRef.current.y-smoothPointer.y)*.065;
      drawGravityWebGL(
        scene,
        width,
        height,
        reducedMotion ? 6000 : elapsed,
        introDurationMs,
        smoothPointer,
        activeIndexRef.current,
        storeCountRef.current,
        selectionVisibleRef.current,
        templateSelectedRef.current,
        launchProgressRef.current,
      );
      const gpuFrame = reducedMotion
        ? null
        : scene.gl.fenceSync(scene.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (gpuFrame) {
        gpuFrames.push(gpuFrame);
        scene.gl.flush();
      }
    };

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      const fieldBounds = field.getBoundingClientRect();
      rootLeft = bounds.left;
      rootTop = bounds.top;
      rootWidth = Math.max(1, bounds.width);
      rootHeight = Math.max(1, bounds.height);
      // The field is fixed to the viewport; using the full document height
      // compresses the black hole whenever the store library grows taller
      // than the screen.
      width = Math.max(1, fieldBounds.width || window.innerWidth);
      height = Math.max(1, fieldBounds.height || window.innerHeight);
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const qualityScale = width >= 700 ? 1 : 0.9;
      const renderScale = Math.min(
        1.25,
        devicePixelRatio * qualityScale * renderScaleMultiplier * adaptiveScale,
      );
      for (const gpuFrame of gpuFrames) scene.gl.deleteSync(gpuFrame);
      gpuFrames = [];
      canvas.width = Math.max(1, Math.floor(width * renderScale));
      canvas.height = Math.max(1, Math.floor(height * renderScale));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      draw(performance.now());
    };

    const syncAppBootState = () => {
      const next = isAppBooting();
      if (next === appBootPaused) return;
      appBootPaused = next;
      field.dataset.animationState = next ? "paused" : "running";
      if (next) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        frame = undefined;
        return;
      }
      // The boot overlay owns the only cinematic entrance. When it releases,
      // hand the dashboard the settled frame instead of replaying its own zoom.
      sceneStartedAt = performance.now() - GRAVITY_SETTLED_ELAPSED_MS;
      draw(performance.now());
      if (!reducedMotion && document.visibilityState === "visible") {
        frame = window.requestAnimationFrame(animate);
      }
    };

    redrawRef.current = () => {
      syncAppBootState();
      draw(performance.now());
    };

    const animate = (time: number) => {
      frame = undefined;
      syncAppBootState();
      if (appBootPaused || contextLost) return;
      // Double buffering avoids an IPC round-trip halving the frame rate, while
      // bounding queued work leaves room for library and pointer updates.
      while (gpuFrames.length > 0) {
        const oldest = gpuFrames[0];
        if (!oldest || scene.gl.clientWaitSync(oldest, 0, 0) === scene.gl.TIMEOUT_EXPIRED) break;
        scene.gl.deleteSync(oldest);
        gpuFrames.shift();
      }
      if (gpuFrames.length >= 2) {
        frame = window.requestAnimationFrame(animate);
        return;
      }
      const interval = time - lastDrawAt;
      // Keep 120/144 Hz monitors from doubling this decorative GPU workload.
      if (time >= nextDrawAt) {
        if (lastDrawAt > 0 && interval < 150) {
          measuredFrames += 1;
          if (interval > 23) slowFrames += 1;
        }
        lastDrawAt = time;
        nextDrawAt = Math.max(nextDrawAt + 1000 / 60, time);
        // Only reduce resolution after sustained pressure, never during one hiccup.
        if (measuredFrames >= 90 || time - qualityWindowStartedAt > 1500) {
          if (measuredFrames > 3 && slowFrames > measuredFrames * 0.4 && adaptiveScale > 0.4) {
            targetScale = Math.max(0.4, targetScale * 0.85);
          } else if (measuredFrames >= 75 && slowFrames === 0 && adaptiveScale < 1) {
            targetScale = Math.min(1, targetScale + 0.05);
          }
          measuredFrames = 0;
          slowFrames = 0;
          qualityWindowStartedAt = time;
        }
        // Small, spaced quality steps avoid an abrupt change in gas sharpness.
        if (time-lastQualityStepAt > 350 && Math.abs(targetScale-adaptiveScale) > .001) {
          adaptiveScale += Math.sign(targetScale-adaptiveScale)*Math.min(.015,Math.abs(targetScale-adaptiveScale));
          lastQualityStepAt = time;
          resize();
        }
        draw(time);
      }
      if (!reducedMotion && !appBootPaused && document.visibilityState === "visible") {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      pointerRef.current = {
        x: Math.min(1, Math.max(0, (event.clientX - rootLeft) / rootWidth)),
        y: Math.min(1, Math.max(0, (event.clientY - rootTop) / rootHeight)),
      };
    };

    const handlePointerLeave = () => {
      pointerRef.current = { x: 0.5, y: 0.35 };
    };

    const handleVisibility = () => {
      const now = performance.now();
      if (document.visibilityState === "hidden") hiddenAt ??= now;
      else if (hiddenAt !== undefined) {
        // Resume the same material phase instead of jumping by hidden wall time.
        sceneStartedAt += now-hiddenAt;
        hiddenAt = undefined;
        nextDrawAt = now;
      }
      lastDrawAt = 0;
      syncAppBootState();
      if (
        document.visibilityState === "visible" &&
        !reducedMotion &&
        !appBootPaused &&
        frame === undefined
      ) {
        frame = window.requestAnimationFrame(animate);
      }
      if (document.visibilityState === "hidden" && frame !== undefined) {
        window.cancelAnimationFrame(frame);
        frame = undefined;
      }
    };

    const handleContextLost = (event: Event) => {
      // preventDefault requests restoration; the CSS image covers the lost frame.
      event.preventDefault();
      contextLost = true;
      gpuFrames = [];
      field.dataset.renderer = "unavailable";
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
    };

    const handleContextRestored = () => {
      const restored = createGravityWebGLScene(canvas);
      if (!restored) return;
      scene = restored;
      contextLost = false;
      field.dataset.renderer = "webgl2";
      lastDrawAt = 0;
      resize();
      if (!reducedMotion && !appBootPaused && document.visibilityState === "visible") {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const handleMotionChange = () => {
      reducedMotion = motionMedia.matches;
      if (reducedMotion) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        frame = undefined;
        adaptiveScale = 1;
        targetScale = 1;
        resize();
      } else if (document.visibilityState === "visible" && !appBootPaused && frame === undefined) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const addMotionListener = () => {
      if (typeof motionMedia.addEventListener === "function") {
        motionMedia.addEventListener("change", handleMotionChange);
      } else {
        motionMedia.addListener(handleMotionChange);
      }
    };

    const removeMotionListener = () => {
      if (typeof motionMedia.removeEventListener === "function") {
        motionMedia.removeEventListener("change", handleMotionChange);
      } else {
        motionMedia.removeListener(handleMotionChange);
      }
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    const bootObserver =
      pauseWhileAppBooting && typeof MutationObserver !== "undefined"
        ? new MutationObserver(syncAppBootState)
        : undefined;
    resizeObserver?.observe(root);
    if (!resizeObserver) window.addEventListener("resize", resize);
    bootObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-solara-boot"],
    });
    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    document.addEventListener("visibilitychange", handleVisibility);
    addMotionListener();
    field.dataset.animationState = appBootPaused ? "paused" : "running";
    resize();
    if (!reducedMotion && !appBootPaused) frame = window.requestAnimationFrame(animate);

    return () => {
      redrawRef.current = null;
      resizeObserver?.disconnect();
      bootObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      document.removeEventListener("visibilitychange", handleVisibility);
      removeMotionListener();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      for (const gpuFrame of gpuFrames) scene.gl.deleteSync(gpuFrame);
      destroyGravityWebGLScene(scene);
    };
  }, [introDurationMs, pauseWhileAppBooting, renderScaleMultiplier]);

  // Redraw on prop changes so reduced-motion mode still reflects selection and launch state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs keep the scene stable while these props trigger a redraw.
  useEffect(() => {
    // The scene is initialized once; redraw keeps state synchronized without
    // rebuilding the WebGL program or its GPU buffers.
    redrawRef.current?.();
  }, [activeIndex, launchProgress, selectionVisible, storeCount, templateSelected]);

  return (
    <div className="dashboard-gravity-field" ref={fieldRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
