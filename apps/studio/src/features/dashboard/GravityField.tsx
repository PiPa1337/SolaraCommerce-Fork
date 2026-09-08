import { useEffect, useRef } from "react";

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
  uniforms: {
    resolution: WebGLUniformLocation | null;
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

/*
 * Gargantua is resolved as a volumetric field in one WebGL2 fragment pass:
 * lensing bends the background, the disk gets depth-dependent temperature,
 * and the photon ring/nodes are drawn in the same coordinate space. There is
 * intentionally no flat-renderer fallback; unsupported WebGL2 only suppresses
 * this decorative layer while the dashboard remains fully operational.
 */
const GRAVITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntroDuration;
uniform vec2 uPointer;
uniform vec2 uCenter;
uniform vec2 uDisk;
uniform float uActiveIndex;
uniform float uStoreCount;
uniform float uSelectionVisible;
uniform float uTemplateSelected;
uniform float uLaunchProgress;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float lowerLeft = hash12(cell);
  float lowerRight = hash12(cell + vec2(1.0, 0.0));
  float upperLeft = hash12(cell + vec2(0.0, 1.0));
  float upperRight = hash12(cell + vec2(1.0, 1.0));
  return mix(
    mix(lowerLeft, lowerRight, local.x),
    mix(upperLeft, upperRight, local.x),
    local.y
  );
}

float layeredNoise(vec2 point) {
  float broad = valueNoise(point);
  float medium = valueNoise(point * 2.07 + vec2(5.3, -3.1));
  float fine = valueNoise(point * 4.13 + vec2(-2.7, 8.4));
  return broad * 0.52 + medium * 0.31 + fine * 0.17;
}

vec3 starLayer(
  vec2 point,
  vec2 grid,
  float threshold,
  vec3 coolColor,
  vec3 warmColor,
  float intensity,
  float phase
) {
  // Keep deterministic sampling without the repeated cross/grid silhouette.
  // Every star receives a small domain warp and its own streak orientation.
  vec2 warpedPoint = point + vec2(
    sin(point.y * 11.0 + phase * 1.7) * 0.014,
    cos(point.x * 9.0 - phase * 1.3) * 0.011
  );
  vec2 scaledPoint = warpedPoint * grid;
  vec2 cell = floor(scaledPoint);
  float seed = hash12(cell + vec2(phase * 2.1, phase * 5.7));
  vec2 jitter = vec2(
    hash12(cell + vec2(phase * 13.7, 19.4)),
    hash12(cell + vec2(-7.9, phase * 23.1))
  ) - 0.5;
  vec2 local = fract(scaledPoint) - 0.5 - jitter * 0.72;
  float enabledStar = smoothstep(threshold - 0.025, threshold + 0.014, seed);
  float radius = mix(0.010, 0.034, fract(seed * 19.7));
  float core = exp(-dot(local, local) / (radius * radius));
  float bloom = exp(-dot(local, local) / (radius * radius * 22.0)) * 0.14;
  float streakAngle = (seed * 2.0 - 1.0) * 0.75 + sin(phase * 2.4) * 0.18;
  float sine = sin(streakAngle);
  float cosine = cos(streakAngle);
  vec2 streakPoint = vec2(
    local.x * cosine - local.y * sine,
    local.x * sine + local.y * cosine
  );
  float streakLength = mix(
    1.0,
    4.6,
    1.0 - smoothstep(0.5, 3.8, uTime * 0.001 * (6000.0 / max(uIntroDuration, 1.0)))
  );
  float streak = exp(-abs(streakPoint.y) / (radius * 0.52))
    * exp(-abs(streakPoint.x) / (radius * (1.4 + streakLength * 2.0)));
  float rays = streak * (1.0 - core) * 0.08;
  float twinkle = 0.82 + 0.18 * sin(uTime * 0.001 * (0.4 + seed * 1.8) + seed * TAU);
  vec3 color = mix(coolColor, warmColor, smoothstep(0.62, 0.96, seed));
  return color * enabledStar * (core + bloom + rays) * twinkle * intensity;
}

vec2 rotatePoint(vec2 point, float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine) * point;
}

float softRing(float distanceToRing, float radius, float width) {
  float normalizedDistance = (distanceToRing - radius) / max(width, 0.0001);
  return exp(-normalizedDistance * normalizedDistance);
}

float angularArc(float angle, float center, float width) {
  float delta = abs(atan(sin(angle - center), cos(angle - center)));
  return 1.0 - smoothstep(width * 0.22, width, delta);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 point = gl_FragCoord.xy / uResolution - 0.5;
  point.x *= aspect;

  float launchProgress = clamp(uLaunchProgress, 0.0, 1.0);
  float launchEase = launchProgress * launchProgress * (3.0 - 2.0 * launchProgress);
  float sceneSeconds = uTime * 0.001;
  float sequenceSeconds = sceneSeconds * (6000.0 / max(uIntroDuration, 1.0));
  float sceneReveal = smoothstep(0.55, 6.0, sequenceSeconds);
  float introZoom = mix(1.56, 1.0, smoothstep(0.65, 6.2, sequenceSeconds));
  float time = sceneSeconds * mix(0.38, 1.0, sceneReveal) * mix(1.0, 3.4, launchEase);
  float viewAngle = -0.08 + (uPointer.x - 0.5) * 0.04;
  vec2 cinematicCenter = mix(uCenter, vec2(0.0), launchEase);
  float cameraZoom = mix(introZoom, 0.23, launchEase);
  vec2 scenePoint = cinematicCenter + (point - cinematicCenter) * cameraZoom;
  vec2 fromCenter = scenePoint - cinematicCenter;
  float distanceFromCenter = max(length(fromCenter), 0.0001);
  vec2 lensDirection = fromCenter / distanceFromCenter;

  // The lens changes the apparent position of the background before the
  // foreground disk is resolved, rather than painting a flat ellipse over it.
  float deflection = 0.052 * exp(-distanceFromCenter / max(uDisk.x * 1.25, 0.01));
  vec2 lensedPoint = scenePoint + lensDirection * deflection / (distanceFromCenter + 0.08);

  vec3 color = vec3(0.0008, 0.0012, 0.0032);
  float halo = exp(-length(fromCenter / vec2(max(uDisk.x * 2.8, 0.01), max(uDisk.y * 8.0, 0.01))) * 1.35);
  color += vec3(0.018, 0.024, 0.052) * halo;

  // The sky is a layered field, not a repeated dot pattern: warped dust,
  // chromatic cloud light, and stars at three apparent depths move differently
  // under the lens so the scene reads as space rather than decoration.
  vec2 cosmicPoint = lensedPoint + vec2(
    (uPointer.x - 0.5) * 0.012,
    (uPointer.y - 0.5) * 0.008
  );
  vec2 nebulaPoint = rotatePoint(cosmicPoint, -0.22);
  float nebulaNoise = layeredNoise(nebulaPoint * vec2(2.8, 6.2) + vec2(time * 0.006, -time * 0.002));
  float nebulaRibbon = exp(-abs(nebulaPoint.y + sin(nebulaPoint.x * 3.2) * 0.075) * 4.6);
  float nebulaMask = smoothstep(0.31, 0.74, nebulaNoise) * nebulaRibbon;
  vec3 nebulaColor = mix(
    vec3(0.012, 0.022, 0.055),
    vec3(0.08, 0.022, 0.042),
    smoothstep(0.38, 0.76, nebulaNoise)
  );
  color += nebulaColor * nebulaMask * 0.16;

  float dustNoise = layeredNoise(nebulaPoint * vec2(5.4, 11.0) + vec2(-time * 0.004, time * 0.003));
  float dustLane = exp(-abs(nebulaPoint.y - sin(nebulaPoint.x * 5.5) * 0.045) * 13.0);
  float dust = smoothstep(0.42, 0.78, dustNoise) * dustLane;
  color *= 1.0 - dust * 0.18;
  color += vec3(0.035, 0.014, 0.018) * dust * 0.22;

  float starVisibility = mix(0.12, 0.42, sceneReveal);
  vec3 stars = vec3(0.0);
  stars += starLayer(
    cosmicPoint * 0.92 + vec2(0.02, -0.015),
    vec2(16.0, 10.0),
    0.88,
    vec3(0.22, 0.29, 0.42),
    vec3(0.76, 0.53, 0.32),
    0.25,
    0.7
  );
  stars += starLayer(
    cosmicPoint * 1.08 + vec2(-0.11, 0.08),
    vec2(34.0, 22.0),
    0.955,
    vec3(0.30, 0.39, 0.58),
    vec3(0.9, 0.68, 0.42),
    0.34,
    1.8
  );
  stars += starLayer(
    cosmicPoint * 1.2 + vec2(0.17, -0.12),
    vec2(62.0, 40.0),
    0.991,
    vec3(0.50, 0.59, 0.72),
    vec3(1.0, 0.78, 0.5),
    0.5,
    2.9
  );
  color += stars * starVisibility;

  // Keep the empty space as a separate layer so the first beats of the scene
  // can reveal the disk progressively instead of flashing the finished ring.
  vec3 skyColor = color;
  vec2 q = rotatePoint(fromCenter, viewAngle);
  float diskX = max(uDisk.x, 0.01);
  float diskY = max(uDisk.y, 0.01);
  vec2 diskPoint = vec2(q.x / diskX, q.y / diskY);
  float diskRadius = length(diskPoint);
  float diskAngle = atan(diskPoint.y, diskPoint.x);
  vec2 diskDirection = diskPoint / max(diskRadius, 0.0001);
  // atan has a branch cut on the horizontal axis. Keep that angle for
  // periodic angular effects only; the noise must use a continuous direction
  // vector or it creates a visible seam across the disk.
  float diskNoise = layeredNoise(vec2(
    diskRadius * 3.6 + diskDirection.y * 1.8 - time * 0.24,
    diskDirection.x * 4.0 + diskRadius * 1.6 + time * 0.08
  ));
  float turbulence = 0.5 + 0.5 * sin(
    diskRadius * 42.0 - time * 2.1 + diskAngle * 8.0 + diskNoise * 4.2
  );
  float spiralWave = 0.5 + 0.5 * sin(
    diskRadius * 29.0 - diskAngle * 8.0 - time * 2.4 + diskNoise * 5.0
  );

  // Layered temperature bands approximate the thick relativistic disk.
  float innerMatter = softRing(diskRadius, 0.48, 0.13);
  float midMatter = softRing(diskRadius, 0.78, 0.18);
  float outerMatter = softRing(diskRadius, 1.06, 0.2);
  float frontWeight = smoothstep(-0.45, 0.75, diskPoint.y);
  float backWeight = 0.32 + (1.0 - frontWeight) * 0.68;
  vec3 innerColor = mix(vec3(0.68, 0.34, 0.25), vec3(1.0, 0.94, 0.74), turbulence);
  vec3 midColor = mix(vec3(0.4, 0.2, 0.17), vec3(0.92, 0.54, 0.3), turbulence * 0.8);
  vec3 outerColor = mix(vec3(0.026, 0.035, 0.062), vec3(0.72, 0.26, 0.08), turbulence * 0.64);
  float relativisticBeaming = 0.48 + smoothstep(-0.18, 0.78, diskPoint.x) * 1.04;
  float equatorialHaze = exp(-abs(q.y) / max(diskY * 0.32, 0.01))
    * smoothstep(1.28, 0.12, diskRadius)
    * (0.34 + diskNoise * 0.7);
  color += vec3(0.26, 0.19, 0.12) * equatorialHaze * relativisticBeaming * 0.2;
  color += innerColor * innerMatter * (0.36 + frontWeight * 0.76) * relativisticBeaming;
  color += midColor * midMatter * (0.16 + backWeight * 0.46) * (0.78 + diskNoise * 0.46);
  color += outerColor * outerMatter * (0.12 + diskNoise * 0.1);

  float filament = smoothstep(0.72, 0.98, spiralWave) * midMatter;
  color += mix(vec3(0.86, 0.38, 0.28), vec3(1.0, 0.78, 0.48), frontWeight)
    * filament
    * (0.18 + frontWeight * 0.24)
    * relativisticBeaming;

  // The far side is lifted above the silhouette; the near side is brighter.
  float farArc = softRing(diskRadius, 0.9, 0.08) * (1.0 - frontWeight);
  float nearArc = softRing(diskRadius, 0.73, 0.055) * frontWeight;
  color += vec3(0.9, 0.55, 0.34) * farArc * 0.48;
  color += vec3(1.0, 0.84, 0.53) * nearArc * 0.82;

  // Hot matter streaks orbit the well at different speeds.
  for (int index = 0; index < 22; index += 1) {
    float item = float(index);
    float seed = hash11(item + 2.7);
    float radius = 0.4 + seed * 0.86;
    float angle = item * 2.41 + time * (0.18 + seed * 0.34);
    vec2 particlePosition = vec2(cos(angle) * diskX * radius, sin(angle) * diskY * radius);
    float particleDistance = length(q - particlePosition);
    float normalizedParticleDistance = particleDistance / (0.003 + (1.0 - seed) * 0.004);
    float streak = exp(-normalizedParticleDistance * normalizedParticleDistance);
    vec3 particleColor = mix(vec3(1.0, 0.87, 0.57), vec3(0.72, 0.34, 0.28), seed);
    color += particleColor * streak * (0.22 + (1.0 - radius * 0.45) * 0.34);
  }

  // Central silhouette and photon ring provide the depth cue.
  float horizonRadius = diskX * 0.48;
  float horizonDistance = length(q);
  float photonRing = softRing(horizonDistance, horizonRadius * 1.12, diskX * 0.015);
  float photonHalo = softRing(horizonDistance, horizonRadius * 1.34, diskX * 0.1);
  float secondaryPhotonRing = softRing(horizonDistance, horizonRadius * 1.54, diskX * 0.018);
  float outerPhotonHalo = softRing(horizonDistance, horizonRadius * 1.9, diskX * 0.13);
  float lensEcho = softRing(horizonDistance, horizonRadius * 2.36, diskX * 0.024);
  float horizontalCaustic = exp(-abs(q.y) / max(diskY * 0.22, 0.01))
    * exp(-horizonDistance / max(diskX * 2.2, 0.01));
  color += vec3(1.0, 0.86, 0.62) * photonRing * 1.35;
  color += vec3(0.72, 0.24, 0.07) * photonHalo * 0.12;
  color += vec3(0.38, 0.34, 0.5) * secondaryPhotonRing * 0.02;
  // Keep the wide cinematic frame dark; a complete outer circle competes
  // with the single hot lensing moment in the reference.
  color += vec3(0.15, 0.18, 0.25) * outerPhotonHalo * 0.0;
  color += vec3(0.78, 0.56, 0.34) * lensEcho * 0.0;
  color += vec3(1.0, 0.4, 0.08) * horizontalCaustic * 0.17;
  float verticalLensedArc = softRing(horizonDistance, horizonRadius * 1.06, diskX * 0.04)
    * smoothstep(0.12, 0.78, abs(q.y) / max(horizonRadius, 0.001));
  color += vec3(1.0, 0.66, 0.32) * verticalLensedArc * 0.34;
  float eventHorizon = 1.0 - smoothstep(horizonRadius * 0.84, horizonRadius * 1.04, horizonDistance);
  color *= 1.0 - eventHorizon * 0.995;
  float outsideHorizon = 1.0 - eventHorizon;

  // Short photon arcs keep the ring alive without becoming a flat outline.
  for (int index = 0; index < 3; index += 1) {
    float item = float(index);
    float arcPhase = time * (0.52 + item * 0.09) + item * 2.1;
    float arc = angularArc(diskAngle, arcPhase, 0.34 + item * 0.07);
    // Keep animation on the outer disk; inner dashed arcs would cut into the
    // event horizon and read as UI chrome instead of light bending.
    float arcRadius = 0.92 + item * 0.08;
    float arcBand = softRing(diskRadius, arcRadius, 0.016 + item * 0.006);
    vec3 arcColor = item < 0.5
      ? vec3(1.0, 0.88, 0.62)
      : item < 1.5
        ? vec3(0.86, 0.45, 0.31)
        : vec3(0.7, 0.32, 0.27);
    color += arcColor * arc * arcBand * (0.42 - item * 0.08) * outsideHorizon;
  }

  // Template and normal-store selection remain tied to React state.
  float orbitCount = clamp(uStoreCount, 0.0, 12.0);
  float safeOrbitCount = max(orbitCount, 1.0);
  float orbitTime = time * 0.16;
  float selectedOrbit = mod(uActiveIndex, safeOrbitCount);
  for (int index = 0; index < 12; index += 1) {
    float item = float(index);
    float visible = step(item + 0.5, orbitCount);
    float angle = item / safeOrbitCount * TAU + orbitTime;
    vec2 nodePosition = vec2(cos(angle) * diskX * 1.36, sin(angle) * diskY * 2.18);
    float selectedNode = (1.0 - step(0.5, abs(item - selectedOrbit)))
      * uSelectionVisible
      * (1.0 - uTemplateSelected);
    float nodeDistance = length(q - nodePosition);
    float normalizedNodeDistance = nodeDistance / (0.005 + selectedNode * 0.006);
    float node = exp(-normalizedNodeDistance * normalizedNodeDistance) * visible;
    vec3 nodeColor = mix(vec3(0.48, 0.51, 0.49), vec3(0.94, 0.75, 0.48), selectedNode);
    color += nodeColor * node * (0.22 + selectedNode * 0.85);
  }

  float selectedSignalAngle = PI - 0.28 + (selectedOrbit / max(safeOrbitCount - 1.0, 1.0)) * 0.56 + orbitTime * 0.22;
  vec2 selectedSignal = vec2(
    cos(selectedSignalAngle) * diskX * 0.92,
    sin(selectedSignalAngle) * diskY * 1.18
  );
  float signalDistance = length(q - selectedSignal);
  float normalizedSignalDistance = signalDistance / 0.009;
  float signal = exp(-normalizedSignalDistance * normalizedSignalDistance)
    * uSelectionVisible
    * (1.0 - uTemplateSelected)
    * step(0.5, orbitCount);
  color += vec3(1.0, 0.84, 0.53) * signal * 1.4;

  float sealRadius = diskX * 0.4;
  float sealBand = softRing(horizonDistance, sealRadius, diskX * 0.012) * uTemplateSelected;
  float sealDash = step(0.0, sin(diskAngle * 11.0 + 0.35));
  color += vec3(0.92, 0.75, 0.48) * sealBand * sealDash * 0.54 * outsideHorizon;

  color = mix(skyColor, color, sceneReveal);

  // Filmic response preserves detail in the bright ring instead of clipping.
  vec3 mapped = 1.0 - exp(-max(color, vec3(0.0)) * 1.32);
  mapped *= 1.0 - smoothstep(0.86, 1.0, launchEase) * 0.62;
  fragColor = vec4(mapped, 1.0);
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

  return {
    gl,
    program,
    vertexArray,
    buffer,
    uniforms: {
      resolution: gl.getUniformLocation(program, "uResolution"),
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
  const centerXBase = wideScene ? 0.65 : tabletScene ? 0.68 : 0.78;
  const centerYBase = wideScene ? 0.64 : tabletScene ? 0.52 : 0.3;
  const centerX = width * (centerXBase + (parallaxPointer.x - 0.5) * 0.035);
  const centerY = height * (centerYBase + (parallaxPointer.y - 0.35) * 0.045);
  const aspect = width / Math.max(height, 1);
  // La referencia trabaja con un horizonte enorme y un disco que atraviesa
  // gran parte del encuadre; se conserva el margen lateral para que la UI
  // siga teniendo aire en desktop y en tablet.
  const diskWidth =
    Math.min(width * (wideScene ? 0.66 : 0.5), wideScene ? 720 : 480) * compactness;
  const diskHeight = Math.max(68, diskWidth * 0.32);

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);
  // WebGL's useProgram is an imperative GPU call, not a React hook.
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API method, not a React hook.
  gl.useProgram(program);
  gl.bindVertexArray(vertexArray);
  gl.uniform2f(uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
    const root =
      field?.closest<HTMLElement>(".app-root--dashboard-cosmic") ?? field?.parentElement;
    if (!field || !canvas || !root) return;

    const scene = createGravityWebGLScene(canvas);
    field.dataset.renderer = scene ? "webgl2" : "unavailable";
    if (!scene) return;

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionMedia.matches;
    let width = 0;
    let height = 0;
    let devicePixelRatio = 1;
    let frame: number | undefined;
    let rootLeft = 0;
    let rootTop = 0;
    let rootWidth = 1;
    let rootHeight = 1;
    const bootStateAtMount = document.documentElement.dataset.solaraBoot;
    const settleSceneAtMount = pauseWhileAppBooting && bootStateAtMount === "entering";
    let sceneStartedAt =
      performance.now() - (settleSceneAtMount ? GRAVITY_SETTLED_ELAPSED_MS : 0);
    const appBootOverlayMountedBeforeMarker =
      pauseWhileAppBooting &&
      document.documentElement.dataset.solaraBoot === undefined &&
      document.querySelector(".app-boot-sequence") !== null;
    const isAppBooting = () =>
      pauseWhileAppBooting && document.documentElement.dataset.solaraBoot === "loading";
    // The overlay and dashboard mount in the same commit. The one-time DOM
    // fallback closes that first-effect race before the overlay writes its dataset.
    let appBootPaused = isAppBooting() || appBootOverlayMountedBeforeMarker;

    const draw = (time: number, settleIntro = false) => {
      if (appBootPaused) return;
      const elapsed = settleIntro
        ? GRAVITY_SETTLED_ELAPSED_MS
        : Math.max(0, time - sceneStartedAt);
      drawGravityWebGL(
        scene,
        width,
        height,
        reducedMotion ? 6000 : elapsed,
        introDurationMs,
        pointerRef.current,
        activeIndexRef.current,
        storeCountRef.current,
        selectionVisibleRef.current,
        templateSelectedRef.current,
        launchProgressRef.current,
      );
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
      const qualityScale = width >= 1200 ? 0.78 : width >= 700 ? 0.72 : 0.64;
      const renderScale = Math.min(1, devicePixelRatio * qualityScale * renderScaleMultiplier);
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
      if (appBootPaused) return;
      draw(time);
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

    const handleMotionChange = () => {
      reducedMotion = motionMedia.matches;
      if (reducedMotion) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        frame = undefined;
        draw(performance.now(), true);
      } else if (
        document.visibilityState === "visible" &&
        !appBootPaused &&
        frame === undefined
      ) {
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
      document.removeEventListener("visibilitychange", handleVisibility);
      removeMotionListener();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      destroyGravityWebGLScene(scene);
    };
  }, []);

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
