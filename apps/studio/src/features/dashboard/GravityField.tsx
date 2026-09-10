import { useEffect, useRef } from "react";
import { GRAVITY_FRAGMENT_SHADER } from "./gravity-cinematic-shader";
import { createGravityDustTexture } from "./gravity-dust-texture";
import {
  DEFAULT_GRAVITY_SETTINGS,
  type GravitySettings,
  type GravityTaaQuality,
} from "./gravitySettings";

interface GravityFieldProps {
  activeIndex: number;
  storeCount: number;
  selectionVisible?: boolean;
  templateSelected?: boolean;
  launchProgress?: number;
  pauseWhileAppBooting?: boolean;
  renderScaleMultiplier?: number;
  clockOrigin?: number | undefined;
  settings?: GravitySettings;
}

interface GravityPointer {
  x: number;
  y: number;
}

// Gargantua conserva una respuesta sutil: queda en el 30% del movimiento
// anterior para que el fondo no domine la interacción del dashboard.
const GRAVITY_PARALLAX_RESPONSE = 0.09;
export const GRAVITY_INTRO_DURATION_MS = 1_500;
// If the GPU briefly stalls, keep the material phase continuous instead of
// advancing the shader by the whole delayed wall-clock interval.
const GRAVITY_MAX_TIME_STEP_MS = 34;

export function clampGravitySceneDelta(time: number, lastTick: number): number {
  return Math.min(GRAVITY_MAX_TIME_STEP_MS, Math.max(0, time - lastTick));
}

interface GravityWebGLScene {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  dust: WebGLTexture;
  taa: GravityTaaTargets | null;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    viewport: WebGLUniformLocation | null;
    dust: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    pointer: WebGLUniformLocation | null;
    center: WebGLUniformLocation | null;
    disk: WebGLUniformLocation | null;
    activeIndex: WebGLUniformLocation | null;
    storeCount: WebGLUniformLocation | null;
    selectionVisible: WebGLUniformLocation | null;
    templateSelected: WebGLUniformLocation | null;
    launchProgress: WebGLUniformLocation | null;
    materialSpeed: WebGLUniformLocation | null;
    starDensity: WebGLUniformLocation | null;
    dustIntensity: WebGLUniformLocation | null;
    haloIntensity: WebGLUniformLocation | null;
    warmth: WebGLUniformLocation | null;
    contrast: WebGLUniformLocation | null;
    diskLayers: WebGLUniformLocation | null;
    turbulence: WebGLUniformLocation | null;
    filamentDetail: WebGLUniformLocation | null;
    gasAbsorption: WebGLUniformLocation | null;
    diskTilt: WebGLUniformLocation | null;
    lensStrength: WebGLUniformLocation | null;
    bloomSpread: WebGLUniformLocation | null;
    causticIntensity: WebGLUniformLocation | null;
    galaxyIntensity: WebGLUniformLocation | null;
    starTwinkle: WebGLUniformLocation | null;
    vignette: WebGLUniformLocation | null;
    staticDiskDetails: WebGLUniformLocation | null;
    taaJitter: WebGLUniformLocation | null;
    taaHistory: WebGLUniformLocation | null;
    taaHistoryWeight: WebGLUniformLocation | null;
    taaHistoryValid: WebGLUniformLocation | null;
  };
}

interface GravityTaaTargets {
  textures: [WebGLTexture, WebGLTexture];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  width: number;
  height: number;
  readIndex: number;
  historyValid: boolean;
}

const GRAVITY_TAA_PROFILES: Record<
  GravityTaaQuality,
  {
    historyWeight: number;
    jitterScale: number;
    sampleCount: number;
    maxFps: number;
  }
> = {
  off: { historyWeight: 0, jitterScale: 0, sampleCount: 1, maxFps: 0 },
  low: { historyWeight: 0.52, jitterScale: 0.35, sampleCount: 2, maxFps: 60 },
  medium: { historyWeight: 0.68, jitterScale: 0.6, sampleCount: 4, maxFps: 36 },
  high: { historyWeight: 0.82, jitterScale: 0.85, sampleCount: 8, maxFps: 24 },
  "very-high": {
    historyWeight: 0.88,
    jitterScale: 1,
    sampleCount: 12,
    maxFps: 20,
  },
  extreme: {
    historyWeight: 0.92,
    jitterScale: 1.15,
    sampleCount: 16,
    maxFps: 15,
  },
};

const GRAVITY_TAA_JITTER_SEQUENCE: ReadonlyArray<readonly [number, number]> = [
  [-0.25, -0.25],
  [0.25, 0.25],
  [0.25, -0.25],
  [-0.25, 0.25],
  [-0.375, 0.125],
  [0.125, -0.375],
  [0.375, 0.375],
  [-0.125, -0.125],
  [-0.1875, 0.3125],
  [0.3125, -0.1875],
  [0.0625, 0.0625],
  [-0.3125, -0.3125],
  [-0.4375, 0.4375],
  [0.4375, -0.4375],
  [0.1875, -0.0625],
  [-0.0625, 0.1875],
];

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
      pointer: gl.getUniformLocation(program, "uPointer"),
      center: gl.getUniformLocation(program, "uCenter"),
      disk: gl.getUniformLocation(program, "uDisk"),
      activeIndex: gl.getUniformLocation(program, "uActiveIndex"),
      storeCount: gl.getUniformLocation(program, "uStoreCount"),
      selectionVisible: gl.getUniformLocation(program, "uSelectionVisible"),
      templateSelected: gl.getUniformLocation(program, "uTemplateSelected"),
      launchProgress: gl.getUniformLocation(program, "uLaunchProgress"),
      materialSpeed: gl.getUniformLocation(program, "uMaterialSpeed"),
      starDensity: gl.getUniformLocation(program, "uStarDensity"),
      dustIntensity: gl.getUniformLocation(program, "uDustIntensity"),
      haloIntensity: gl.getUniformLocation(program, "uHaloIntensity"),
      warmth: gl.getUniformLocation(program, "uWarmth"),
      contrast: gl.getUniformLocation(program, "uContrast"),
      diskLayers: gl.getUniformLocation(program, "uDiskLayers"),
      turbulence: gl.getUniformLocation(program, "uTurbulence"),
      filamentDetail: gl.getUniformLocation(program, "uFilamentDetail"),
      gasAbsorption: gl.getUniformLocation(program, "uGasAbsorption"),
      diskTilt: gl.getUniformLocation(program, "uDiskTilt"),
      lensStrength: gl.getUniformLocation(program, "uLensStrength"),
      bloomSpread: gl.getUniformLocation(program, "uBloomSpread"),
      causticIntensity: gl.getUniformLocation(program, "uCausticIntensity"),
      galaxyIntensity: gl.getUniformLocation(program, "uGalaxyIntensity"),
      starTwinkle: gl.getUniformLocation(program, "uStarTwinkle"),
      vignette: gl.getUniformLocation(program, "uVignette"),
      staticDiskDetails: gl.getUniformLocation(program, "uStaticDiskDetails"),
      taaJitter: gl.getUniformLocation(program, "uTaaJitter"),
      taaHistory: gl.getUniformLocation(program, "uTaaHistory"),
      taaHistoryWeight: gl.getUniformLocation(program, "uTaaHistoryWeight"),
      taaHistoryValid: gl.getUniformLocation(program, "uTaaHistoryValid"),
    },
    taa: null,
  };
}

function destroyGravityTaaTargets(gl: WebGL2RenderingContext, targets: GravityTaaTargets) {
  for (const framebuffer of targets.framebuffers) gl.deleteFramebuffer(framebuffer);
  for (const texture of targets.textures) gl.deleteTexture(texture);
}

function createGravityTaaTargets(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): GravityTaaTargets | null {
  // El historial conserva exactamente el tamaño del canvas elegido por
  // renderScaleMultiplier. La calidad TAA cambia muestras y acumulación, no la
  // resolución: 100% + Bajo sigue renderizando sobre el canvas al 100%.
  const targetWidth = Math.max(1, Math.floor(width));
  const targetHeight = Math.max(1, Math.floor(height));
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const cleanup = () => {
    for (const texture of textures) gl.deleteTexture(texture);
    for (const framebuffer of framebuffers) gl.deleteFramebuffer(framebuffer);
  };

  for (let index = 0; index < 2; index += 1) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      cleanup();
      return null;
    }
    textures.push(texture);
    framebuffers.push(framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      cleanup();
      return null;
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const firstTexture = textures[0];
  const secondTexture = textures[1];
  const firstFramebuffer = framebuffers[0];
  const secondFramebuffer = framebuffers[1];
  if (!firstTexture || !secondTexture || !firstFramebuffer || !secondFramebuffer) {
    cleanup();
    return null;
  }
  return {
    textures: [firstTexture, secondTexture],
    framebuffers: [firstFramebuffer, secondFramebuffer],
    width: targetWidth,
    height: targetHeight,
    readIndex: 0,
    historyValid: false,
  };
}

function ensureGravityTaaTargets(
  scene: GravityWebGLScene,
  width: number,
  height: number,
): GravityTaaTargets | null {
  if (scene.taa?.width === width && scene.taa.height === height) {
    return scene.taa;
  }
  if (scene.taa) destroyGravityTaaTargets(scene.gl, scene.taa);
  scene.taa = createGravityTaaTargets(scene.gl, width, height);
  return scene.taa;
}

function destroyGravityWebGLScene(scene: GravityWebGLScene) {
  if (scene.taa) destroyGravityTaaTargets(scene.gl, scene.taa);
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
  pointer: GravityPointer,
  activeIndex: number,
  storeCount: number,
  selectionVisible: boolean,
  templateSelected: boolean,
  launchProgress: number,
  settings: GravitySettings,
  taaJitter: readonly [number, number],
  taaHistoryTexture: WebGLTexture | null,
  taaHistoryWeight: number,
  taaHistoryValid: boolean,
  outputWidth?: number,
  outputHeight?: number,
) {
  const { gl, program, vertexArray, uniforms } = scene;
  const framebufferWidth = outputWidth ?? gl.drawingBufferWidth;
  const framebufferHeight = outputHeight ?? gl.drawingBufferHeight;
  const wideScene = width >= 1120;
  const tabletScene = width >= 700;
  const compactness = Math.min(1, Math.max(0.72, width / 1320));
  const parallaxPointer = {
    x: 0.5 + (pointer.x - 0.5) * GRAVITY_PARALLAX_RESPONSE * settings.pointerResponse,
    y: 0.35 + (pointer.y - 0.35) * GRAVITY_PARALLAX_RESPONSE * settings.pointerResponse,
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

  gl.viewport(0, 0, framebufferWidth, framebufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // WebGL's useProgram is an imperative GPU call, not a React hook.
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);
  gl.uniform2f(uniforms.resolution, framebufferWidth, framebufferHeight);
  gl.uniform2f(uniforms.viewport, width, height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, scene.dust);
  gl.uniform1i(uniforms.dust, 0);
  gl.uniform1f(uniforms.time, time);
  gl.uniform2f(uniforms.pointer, parallaxPointer.x, parallaxPointer.y);
  gl.uniform2f(uniforms.center, (centerX / width - 0.5) * aspect, 0.5 - centerY / height);
  gl.uniform2f(uniforms.disk, diskWidth / height, diskHeight / height);
  gl.uniform1f(uniforms.activeIndex, activeIndex);
  gl.uniform1f(uniforms.storeCount, Math.min(12, Math.max(0, storeCount)));
  gl.uniform1f(uniforms.selectionVisible, selectionVisible ? 1 : 0);
  gl.uniform1f(uniforms.templateSelected, templateSelected ? 1 : 0);
  gl.uniform1f(uniforms.launchProgress, Math.min(1, Math.max(0, launchProgress)));
  gl.uniform1f(uniforms.materialSpeed, settings.materialSpeed);
  gl.uniform1f(uniforms.starDensity, settings.starDensity);
  gl.uniform1f(uniforms.dustIntensity, settings.dustIntensity);
  gl.uniform1f(uniforms.haloIntensity, settings.haloIntensity);
  gl.uniform1f(uniforms.warmth, settings.warmth);
  gl.uniform1f(uniforms.contrast, settings.contrast);
  gl.uniform1f(uniforms.diskLayers, settings.diskLayers);
  gl.uniform1f(uniforms.turbulence, settings.turbulence);
  gl.uniform1f(uniforms.filamentDetail, settings.filamentDetail);
  gl.uniform1f(uniforms.gasAbsorption, settings.gasAbsorption);
  gl.uniform1f(uniforms.diskTilt, settings.diskTilt);
  gl.uniform1f(uniforms.lensStrength, settings.lensStrength);
  gl.uniform1f(uniforms.bloomSpread, settings.bloomSpread);
  gl.uniform1f(uniforms.causticIntensity, settings.causticIntensity);
  gl.uniform1f(uniforms.galaxyIntensity, settings.galaxyIntensity);
  gl.uniform1f(uniforms.starTwinkle, settings.starTwinkle);
  gl.uniform1f(uniforms.vignette, settings.vignette);
  gl.uniform1f(uniforms.staticDiskDetails, settings.staticDiskDetails ? 1 : 0);
  gl.uniform2f(uniforms.taaJitter, taaJitter[0], taaJitter[1]);
  if (uniforms.taaHistory) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, taaHistoryTexture);
    gl.uniform1i(uniforms.taaHistory, 1);
    gl.uniform1f(uniforms.taaHistoryWeight, taaHistoryWeight);
    gl.uniform1f(uniforms.taaHistoryValid, taaHistoryValid ? 1 : 0);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export function GravityField({
  activeIndex,
  storeCount,
  selectionVisible = true,
  templateSelected = false,
  launchProgress = 0,
  pauseWhileAppBooting = true,
  renderScaleMultiplier = 1,
  clockOrigin,
  settings = DEFAULT_GRAVITY_SETTINGS,
}: GravityFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<GravityPointer>({ x: 0.5, y: 0.35 });
  const activeIndexRef = useRef(activeIndex);
  const storeCountRef = useRef(storeCount);
  const selectionVisibleRef = useRef(selectionVisible);
  const templateSelectedRef = useRef(templateSelected);
  const launchProgressRef = useRef(launchProgress);
  const settingsRef = useRef(settings);
  const pauseWhileAppBootingRef = useRef(pauseWhileAppBooting);
  const renderScaleMultiplierRef = useRef(renderScaleMultiplier);
  const clockOriginRef = useRef(clockOrigin);
  const redrawRef = useRef<(() => void) | null>(null);
  activeIndexRef.current = activeIndex;
  storeCountRef.current = storeCount;
  selectionVisibleRef.current = selectionVisible;
  templateSelectedRef.current = templateSelected;
  launchProgressRef.current = launchProgress;
  settingsRef.current = settings;
  pauseWhileAppBootingRef.current = pauseWhileAppBooting;
  renderScaleMultiplierRef.current = renderScaleMultiplier;
  clockOriginRef.current = clockOrigin;

  // Keep the WebGL scene alive across boot phases; the clock and pause flags
  // must not trigger shader compilation during the first visible transition.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs keep the WebGL scene stable for the component lifetime.
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
    let sceneStartedAt = clockOriginRef.current ?? performance.now();
    let appliedClockOrigin = clockOriginRef.current;
    let sceneTime = 0;
    let lastSceneTick = sceneStartedAt;
    let taaFrameIndex = 0;
    const appBootOverlayMountedBeforeMarker =
      pauseWhileAppBootingRef.current &&
      document.documentElement.dataset.solaraBoot === undefined &&
      document.querySelector('.app-boot-sequence[data-boot-phase="loading"]') !== null;
    const isAppBooting = () =>
      pauseWhileAppBootingRef.current && document.documentElement.dataset.solaraBoot === "loading";
    // The overlay and dashboard mount in the same commit. The one-time DOM
    // fallback closes that first-effect race before the overlay writes its dataset.
    let appBootPaused = isAppBooting() || appBootOverlayMountedBeforeMarker;
    let entryPaused = document.documentElement.dataset.solaraBoot === "entering";
    let entryPausedAt: number | undefined = entryPaused ? performance.now() : undefined;
    const shouldAnimate = () =>
      !reducedMotion &&
      !appBootPaused &&
      (!settingsRef.current.pauseWhenHidden || document.visibilityState === "visible");

    const syncClockOrigin = () => {
      const nextClockOrigin = clockOriginRef.current;
      if (nextClockOrigin === appliedClockOrigin) return;
      sceneStartedAt = nextClockOrigin ?? performance.now();
      appliedClockOrigin = nextClockOrigin;
      sceneTime = 0;
      lastSceneTick = sceneStartedAt;
    };

    const draw = (time: number) => {
      syncClockOrigin();
      if (appBootPaused || contextLost) return;
      if (!reducedMotion && gpuFrames.length >= 2) return;
      const currentSettings = settingsRef.current;
      const taaProfile = GRAVITY_TAA_PROFILES[currentSettings.taaQuality];
      const taaEnabled = !reducedMotion && currentSettings.taaQuality !== "off";
      const taaTargets = taaEnabled
        ? ensureGravityTaaTargets(
            scene,
            scene.gl.drawingBufferWidth,
            scene.gl.drawingBufferHeight,
          )
        : null;
      if (!taaEnabled && scene.taa) {
        destroyGravityTaaTargets(scene.gl, scene.taa);
        scene.taa = null;
        taaFrameIndex = 0;
      }
      const taaJitterSample =
        GRAVITY_TAA_JITTER_SEQUENCE[taaFrameIndex % taaProfile.sampleCount] ?? [0, 0];
      const taaJitter: readonly [number, number] = taaTargets
        ? [
            taaJitterSample[0] * taaProfile.jitterScale,
            taaJitterSample[1] * taaProfile.jitterScale,
          ]
        : [0, 0];
      const taaState = taaTargets
        ? "active"
        : currentSettings.taaQuality === "off"
          ? "off"
          : "unavailable";
      if (field.dataset.taaQuality !== currentSettings.taaQuality) {
        field.dataset.taaQuality = currentSettings.taaQuality;
      }
      if (field.dataset.taaState !== taaState) field.dataset.taaState = taaState;
      const taaResolution = taaTargets
        ? `${taaTargets.width}x${taaTargets.height}`
        : `${scene.gl.drawingBufferWidth}x${scene.gl.drawingBufferHeight}`;
      if (field.dataset.taaResolution !== taaResolution) {
        field.dataset.taaResolution = taaResolution;
      }
      const taaWriteIndex = taaTargets ? 1 - taaTargets.readIndex : 0;
      const taaReadTexture = taaTargets
        ? taaTargets.readIndex === 0
          ? taaTargets.textures[0]
          : taaTargets.textures[1]
        : null;
      const taaWriteFramebuffer = taaTargets
        ? taaWriteIndex === 0
          ? taaTargets.framebuffers[0]
          : taaTargets.framebuffers[1]
        : null;
      if (taaTargets) scene.gl.bindFramebuffer(scene.gl.FRAMEBUFFER, taaWriteFramebuffer);
      const sceneDelta = clampGravitySceneDelta(time, lastSceneTick);
      lastSceneTick = time;
      sceneTime += sceneDelta;
      smoothPointer.x += (pointerRef.current.x-smoothPointer.x)*.065;
      smoothPointer.y += (pointerRef.current.y-smoothPointer.y)*.065;
      drawGravityWebGL(
        scene,
        width,
        height,
        reducedMotion ? 6000 : sceneTime,
        smoothPointer,
        activeIndexRef.current,
        storeCountRef.current,
        selectionVisibleRef.current,
        templateSelectedRef.current,
        launchProgressRef.current,
        currentSettings,
        taaJitter,
        taaReadTexture,
        taaProfile.historyWeight,
        taaTargets?.historyValid ?? false,
        taaTargets?.width,
        taaTargets?.height,
      );
      if (taaTargets) {
        scene.gl.bindFramebuffer(scene.gl.READ_FRAMEBUFFER, taaWriteFramebuffer);
        scene.gl.bindFramebuffer(scene.gl.DRAW_FRAMEBUFFER, null);
        scene.gl.blitFramebuffer(
          0,
          0,
          taaTargets.width,
          taaTargets.height,
          0,
          0,
          scene.gl.drawingBufferWidth,
          scene.gl.drawingBufferHeight,
          scene.gl.COLOR_BUFFER_BIT,
          scene.gl.LINEAR,
        );
        scene.gl.bindFramebuffer(scene.gl.FRAMEBUFFER, null);
        taaTargets.readIndex = taaWriteIndex;
        taaTargets.historyValid = true;
        taaFrameIndex += 1;
      }
      const gpuFrame = reducedMotion
        ? null
        : scene.gl.fenceSync(scene.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (gpuFrame) {
        gpuFrames.push(gpuFrame);
        scene.gl.flush();
      }
    };

    const resizeCanvas = () => {
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
        2.5,
        devicePixelRatio *
          qualityScale *
          renderScaleMultiplierRef.current *
          settingsRef.current.renderScaleMultiplier *
          adaptiveScale,
      );
      for (const gpuFrame of gpuFrames) scene.gl.deleteSync(gpuFrame);
      gpuFrames = [];
      canvas.width = Math.max(1, Math.floor(width * renderScale));
      canvas.height = Math.max(1, Math.floor(height * renderScale));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const resize = () => {
      resizeCanvas();
      draw(performance.now());
    };

    const syncAppBootState = () => {
      const next = isAppBooting();
      const entering = document.documentElement.dataset.solaraBoot === "entering";
      if (next === appBootPaused && entering === entryPaused) return;
      const wasLoading = appBootPaused;
      const now = performance.now();
      appBootPaused = next;
      entryPaused = entering;
      field.dataset.animationState = next || entering ? "paused" : "running";
      if (next || entering) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        frame = undefined;
        if (entering) {
          entryPausedAt = now;
          // Prepare the dashboard once, then crossfade retained canvases while
          // the glass controls enter. Two live shaders starved this transition.
          if (wasLoading) {
            draw(now);
          }
        }
        return;
      }
      if (entryPausedAt !== undefined) {
        sceneStartedAt += now - entryPausedAt;
        lastSceneTick = now;
        entryPausedAt = undefined;
      }
      draw(performance.now());
      if (shouldAnimate()) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    redrawRef.current = () => {
      if (scene.taa) scene.taa.historyValid = false;
      taaFrameIndex = 0;
      syncClockOrigin();
      resizeCanvas();
      syncAppBootState();
      draw(performance.now());
      if (shouldAnimate() && frame === undefined) frame = window.requestAnimationFrame(animate);
    };

    const animate = (time: number) => {
      frame = undefined;
      syncAppBootState();
      if (appBootPaused || entryPaused || contextLost) return;
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
        // Sustained GPU stalls must count too; excluding >150 ms intervals
        // prevented quality adaptation precisely on the slowest renderers.
        if (lastDrawAt > 0) {
          measuredFrames += 1;
          if (interval > 23) slowFrames += 1;
        }
        lastDrawAt = time;
        const taaMaxFps = GRAVITY_TAA_PROFILES[settingsRef.current.taaQuality].maxFps;
        const frameRate =
          taaMaxFps > 0 ? Math.min(settingsRef.current.maxFps, taaMaxFps) : settingsRef.current.maxFps;
        nextDrawAt = Math.max(nextDrawAt + 1000 / frameRate, time);
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
          resizeCanvas();
        }
        draw(time);
      }
      if (shouldAnimate()) {
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
      if (document.visibilityState === "hidden" && settingsRef.current.pauseWhenHidden) {
        hiddenAt ??= now;
      } else if (hiddenAt !== undefined && settingsRef.current.pauseWhenHidden) {
        // Resume the same material phase instead of jumping by hidden wall time.
        sceneStartedAt += now-hiddenAt;
        hiddenAt = undefined;
        nextDrawAt = now;
        lastSceneTick = now;
      }
      if (scene.taa) scene.taa.historyValid = false;
      taaFrameIndex = 0;
      if (!settingsRef.current.pauseWhenHidden) hiddenAt = undefined;
      lastDrawAt = 0;
      syncAppBootState();
      if (shouldAnimate() && frame === undefined) {
        frame = window.requestAnimationFrame(animate);
      }
      if (
        document.visibilityState === "hidden" &&
        settingsRef.current.pauseWhenHidden &&
        frame !== undefined
      ) {
        window.cancelAnimationFrame(frame);
        frame = undefined;
      }
    };

    const handleContextLost = (event: Event) => {
      // preventDefault requests restoration; the CSS image covers the lost frame.
      event.preventDefault();
      contextLost = true;
      scene.taa = null;
      taaFrameIndex = 0;
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
      taaFrameIndex = 0;
      field.dataset.renderer = "webgl2";
      lastDrawAt = 0;
      resize();
      if (shouldAnimate()) {
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
      } else if (shouldAnimate() && frame === undefined) {
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
      typeof MutationObserver !== "undefined"
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
    field.dataset.animationState = appBootPaused || entryPaused ? "paused" : "running";
    resize();
    if (shouldAnimate()) frame = window.requestAnimationFrame(animate);

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
  }, []);

  // Redraw on prop changes so reduced-motion mode still reflects selection and launch state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs keep the scene stable while these props trigger a redraw.
  useEffect(() => {
    // The scene is initialized once; redraw keeps state synchronized without
    // rebuilding the WebGL program or its GPU buffers.
    redrawRef.current?.();
  }, [
    activeIndex,
    clockOrigin,
    launchProgress,
    pauseWhileAppBooting,
    renderScaleMultiplier,
    settings,
    selectionVisible,
    storeCount,
    templateSelected,
  ]);

  return (
    <div className="dashboard-gravity-field" ref={fieldRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
