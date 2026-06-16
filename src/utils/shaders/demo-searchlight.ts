import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Patch three.js Raycaster to use BVH when geometry has one. Doing this
// once at module load is the documented pattern.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// --------------------------------------------------------------------------
// Beam shader — GLSL port of SearchlightBeam.shader (HLSL).
// The deliberate UV.x-removal seam-fix comment is preserved from the
// original source. The depth-fade uses three.js's standard DepthTexture
// instead of URP's _CameraDepthTexture but does the same linear-eye-depth
// reconstruction.
// --------------------------------------------------------------------------

const BEAM_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vClipW;

void main() {
  vUv = uv;
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 clip = projectionMatrix * viewMatrix * worldPos4;
  vClipW = clip.w;
  gl_Position = clip;
}
`;

const BEAM_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uSceneDepth;
uniform vec2  uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uTime;

uniform vec3  uColorNear;
uniform vec3  uColorFar;
uniform float uIntensity;
uniform float uEdgeSoftness;
uniform float uCoreSoftness;
uniform float uCoreIntensity;
uniform float uDistanceFalloff;
uniform float uHitFade;
uniform float uDepthFade;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uNoiseStrength;
uniform float uFlickerSpeed;
uniform float uFlickerAmount;
uniform float uStutterChance;
uniform float uStutterAmount;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying float vClipW;

vec3 hash3D(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7,  74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(dot(hash3D(i + vec3(0,0,0)), f - vec3(0,0,0)),
          dot(hash3D(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
      mix(dot(hash3D(i + vec3(0,1,0)), f - vec3(0,1,0)),
          dot(hash3D(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x),
      u.y),
    mix(
      mix(dot(hash3D(i + vec3(0,0,1)), f - vec3(0,0,1)),
          dot(hash3D(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
      mix(dot(hash3D(i + vec3(0,1,1)), f - vec3(0,1,1)),
          dot(hash3D(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x),
      u.y),
    u.z);
}

float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar)
       / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

void main() {
  // --- Depth fade ---
  vec2 screenUV = gl_FragCoord.xy / uResolution;
  float rawDepth = texture2D(uSceneDepth, screenUV).r;
  float sceneDepth = linearizeDepth(rawDepth);
  float coneDepth = vClipW;
  float depthDiff = sceneDepth - coneDepth;
  float depthMask = clamp(depthDiff / max(uDepthFade, 0.001), 0.0, 1.0);

  // --- Distance falloff ---
  float distFade = pow(1.0 - vUv.y, uDistanceFalloff);

  // --- Hit fade at tip ---
  float hitFade = 1.0 - smoothstep(1.0 - uHitFade, 1.0, vUv.y);

  // --- Fresnel-based shape ---
  // UV.x is removed entirely — it caused seam artifacts because UV.x = 0
  // and UV.x = 1 are the same world position but both evaluate to
  // distFromCenter = 0.5, always at the edge cutoff. Surface normal vs
  // view direction is enough; the mesh boundary is the hard cutoff.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnelDot = abs(dot(normalize(vWorldNormal), viewDir));
  float edgeFade = pow(fresnelDot, 1.0 / max(uEdgeSoftness, 0.01));
  float volumeGlow = pow(fresnelDot, uCoreSoftness) * uCoreIntensity;
  float beamShape = clamp(edgeFade + volumeGlow, 0.0, 1.0);

  // --- Flicker (electrical hum + stutter) ---
  float hum = sin(uTime * uFlickerSpeed) * uFlickerAmount + (1.0 - uFlickerAmount);
  float stutter = (1.0 - uStutterAmount) * step(uStutterChance, fract(uTime * 0.3));
  float flicker = hum * stutter;

  // --- 3D world-space noise ---
  vec3 noisePos = vWorldPos * uNoiseScale + vec3(0.0, -uTime * uNoiseSpeed, 0.0);
  float noiseVal = noise3D(noisePos) * 0.5 + 0.5;
  float noiseMod = mix(1.0 - uNoiseStrength, 1.0, noiseVal);

  // --- Color gradient ---
  vec3 beamColor = mix(uColorNear, uColorFar, vUv.y);

  // --- Final ---
  float beam = distFade * beamShape * uIntensity * flicker * hitFade * noiseMod * depthMask;
  gl_FragColor = vec4(beamColor * beam, 1.0);
}
`;

// --------------------------------------------------------------------------
// Presets — values lifted from the shipped Searchlight System asset.
// --------------------------------------------------------------------------

interface Preset {
  name: string;
  range: number;
  angle: number;
  colorNear: [number, number, number];
  colorFar: [number, number, number];
  intensity: number;
  edgeSoftness: number;
  coreSoftness: number;
  coreIntensity: number;
  distanceFalloff: number;
  hitFade: number;
  depthFade: number;
  noiseScale: number;
  noiseSpeed: number;
  noiseStrength: number;
  flickerSpeed: number;
  flickerAmount: number;
  stutterChance: number;
  stutterAmount: number;
}

const DEFAULT_PRESET: Preset = {
  name: 'Default',
  range: 20,
  angle: 59,
  colorNear: [1.0, 0.95, 0.706],
  colorFar: [0.55, 0.65, 0.863],
  intensity: 2.5,
  edgeSoftness: 1.5,
  coreSoftness: 2.0,
  coreIntensity: 1.4,
  distanceFalloff: 1.1,
  hitFade: 0.1,
  depthFade: 2.0,
  noiseScale: 2.5,
  noiseSpeed: 1.0,
  noiseStrength: 0.1,
  flickerSpeed: 23.7,
  flickerAmount: 0.0,
  stutterChance: 0.0,
  stutterAmount: 0.1,
};

// --------------------------------------------------------------------------
// Cone mesh construction. Direct port of SearchlightConeJobSystem.cs
// BuildMesh + SmoothSeamNormals. The inner-ring Min() clamp is the
// one-line wall-clipping fix from the project page.
// --------------------------------------------------------------------------

interface ConeState {
  sides: number;
  ringCount: number;
  range: number;
  angle: number;
  hitDistances: Float32Array;
}

function buildConeGeometry(state: ConeState): THREE.BufferGeometry {
  const { sides, ringCount, range, angle, hitDistances } = state;
  const halfAngleRad = (angle * 0.5 * Math.PI) / 180;
  const baseRadius = range * Math.tan(halfAngleRad);
  const vertsPerRing = sides + 1;
  const totalVerts = 1 + (ringCount + 1) * vertsPerRing;

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  // Apex
  positions[0] = 0;
  positions[1] = 0;
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0;

  // Cone built along +Y; parent group rotates it to aim.
  for (let ring = 0; ring <= ringCount; ring++) {
    const ringT = (ring + 1) / (ringCount + 1);
    const isOuterRim = ring === ringCount;
    for (let i = 0; i <= sides; i++) {
      const t = i / sides;
      const radian = t * Math.PI * 2;
      const x = Math.sin(radian) * baseRadius;
      const z = Math.cos(radian) * baseRadius;
      const fx = x;
      const fy = range;
      const fz = z;
      const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
      const dx = fx / flen;
      const dy = fy / flen;
      const dz = fz / flen;

      // The one-line wall-clipping fix.
      const hitDist = isOuterRim ? hitDistances[i] : Math.min(range * ringT, hitDistances[i]);

      const vertIdx = 1 + ring * vertsPerRing + i;
      positions[vertIdx * 3 + 0] = dx * hitDist;
      positions[vertIdx * 3 + 1] = dy * hitDist;
      positions[vertIdx * 3 + 2] = dz * hitDist;
      uvs[vertIdx * 2 + 0] = t;
      uvs[vertIdx * 2 + 1] = hitDist / range;
    }
  }

  const triCount = sides * (ringCount + 1) * 2 * 3;
  const indices = new Uint16Array(triCount);
  let tIdx = 0;

  // Apex → first ring
  for (let i = 0; i < sides; i++) {
    indices[tIdx++] = 0;
    indices[tIdx++] = 1 + i + 1;
    indices[tIdx++] = 1 + i;
  }

  // Ring → next ring
  for (let ring = 0; ring < ringCount; ring++) {
    const ringStart = 1 + ring * vertsPerRing;
    const nextRingStart = 1 + (ring + 1) * vertsPerRing;
    for (let i = 0; i < sides; i++) {
      const curr = ringStart + i;
      const currNext = ringStart + i + 1;
      const next = nextRingStart + i;
      const nextNext = nextRingStart + i + 1;
      indices[tIdx++] = curr;
      indices[tIdx++] = nextNext;
      indices[tIdx++] = next;
      indices[tIdx++] = curr;
      indices[tIdx++] = currNext;
      indices[tIdx++] = nextNext;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  smoothSeamNormals(geom);
  geom.computeBoundingSphere();
  return geom;
}

// Vertices at UV.x=0 and UV.x=1 share the same world position but are
// separate vertex entries, so RecalculateNormals leaves the seam with
// divergent normals. Average them. O(n²) but tiny vertex counts.
function smoothSeamNormals(geom: THREE.BufferGeometry): void {
  const positions = geom.attributes.position.array as Float32Array;
  const normals = geom.attributes.normal.array as Float32Array;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    let nx = normals[i * 3];
    let ny = normals[i * 3 + 1];
    let nz = normals[i * 3 + 2];
    let n = 1;
    for (let j = i + 1; j < count; j++) {
      const dx = positions[j * 3] - px;
      const dy = positions[j * 3 + 1] - py;
      const dz = positions[j * 3 + 2] - pz;
      if (dx * dx + dy * dy + dz * dz < 0.0001) {
        nx += normals[j * 3];
        ny += normals[j * 3 + 1];
        nz += normals[j * 3 + 2];
        n++;
      }
    }
    if (n > 1) {
      nx /= n;
      ny /= n;
      nz /= n;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      for (let j = i; j < count; j++) {
        const dx = positions[j * 3] - px;
        const dy = positions[j * 3 + 1] - py;
        const dz = positions[j * 3 + 2] - pz;
        if (dx * dx + dy * dy + dz * dz < 0.0001) {
          normals[j * 3] = nx;
          normals[j * 3 + 1] = ny;
          normals[j * 3 + 2] = nz;
        }
      }
    }
  }
  geom.attributes.normal.needsUpdate = true;
}

// --------------------------------------------------------------------------
// Public mount
// --------------------------------------------------------------------------

export function mountSearchlight(root: HTMLElement): () => void {
  // --- Shell HTML ---
  root.classList.add('lab-demo', 'lab-demo-searchlight');
  root.innerHTML = `
    <header class="lab-header">
      <h3>Searchlight — Volumetric Beam</h3>
      <p>
        Full port of the Searchlight System asset. Procedural cone mesh
        rebuilt each frame from BVH raycasts, depth-buffer soft intersection,
        the same flicker + atmospheric noise. Toggle <strong>control</strong>
        between camera (orbit the scene) and beam (point the cursor to aim it
        at walls).
      </p>
    </header>
    <div class="lab-canvas" data-sl-canvas>
      <div class="sl-mode-toggle" data-sl-mode-wrap>
        <span>control <em>(middle-click to toggle)</em></span>
        <div class="mv-segmented" data-sl-mode>
          <button type="button" data-sl-mode-btn="camera">camera</button>
          <button type="button" data-sl-mode-btn="beam">beam</button>
        </div>
      </div>
    </div>
    <div class="lab-controls" data-sl-controls></div>
    <details class="lab-source">
      <summary>view GLSL source (beam shader)</summary>
      <pre><code data-sl-source></code></pre>
    </details>
  `;

  const canvasWrap = root.querySelector('[data-sl-canvas]') as HTMLElement;
  const controlsWrap = root.querySelector('[data-sl-controls]') as HTMLElement;
  const sourceEl = root.querySelector('[data-sl-source]') as HTMLElement;
  sourceEl.textContent = BEAM_FRAGMENT.trim();

  // --- Renderer + scene ---
  const initialW = Math.max(canvasWrap.clientWidth, 320);
  const initialH = Math.max(canvasWrap.clientHeight, 420);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, initialW / initialH, 0.1, 80);
  camera.position.set(8, 7, 10);
  camera.lookAt(0, 1, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 1, 0);
  controls.minDistance = 4;
  controls.maxDistance = 55;
  controls.maxPolarAngle = Math.PI * 0.48;

  // Ambient + faint key, just enough to read walls without washing the beam.
  scene.add(new THREE.AmbientLight(0x1a1d24, 1.0));
  const keyLight = new THREE.DirectionalLight(0x6b7282, 0.5);
  keyLight.position.set(-4, 6, 3);
  scene.add(keyLight);

  // --- Static scene: floor + a few walls/pillars the beam can wrap around ---
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f24,
    roughness: 0.95,
    metalness: 0.0,
  });
  const floorGeom = new THREE.PlaneGeometry(24, 24);
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  staticGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2b3038,
    roughness: 0.85,
    metalness: 0.0,
  });

  function addBlock(x: number, z: number, w: number, h: number, d: number): THREE.Mesh {
    const geom = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geom, wallMat);
    m.position.set(x, h / 2, z);
    staticGroup.add(m);
    return m;
  }

  const block1 = addBlock(-3.5, -1.5, 2.0, 3.2, 1.0);
  const block2 = addBlock(2.5, 1.0, 1.0, 2.4, 3.0);
  const block3 = addBlock(0.0, 4.5, 4.0, 2.0, 0.8);
  const block4 = addBlock(4.5, -3.5, 1.2, 1.6, 1.2);

  // --- BVH over a merged static collider (excludes the floor below cone) ---
  // We include floor so the beam terminates on it; transform each box to
  // world space before merging because BVH lives in geometry-local space.
  const colliderGeoms: THREE.BufferGeometry[] = [];
  for (const m of [floor, block1, block2, block3, block4]) {
    const g = m.geometry.clone();
    m.updateMatrixWorld(true);
    g.applyMatrix4(m.matrixWorld);
    colliderGeoms.push(g);
  }
  const colliderGeometry = BufferGeometryUtils.mergeGeometries(colliderGeoms, false)!;
  for (const g of colliderGeoms) g.dispose();
  const bvh = new MeshBVH(colliderGeometry);
  const colliderMesh = new THREE.Mesh(colliderGeometry, new THREE.MeshBasicMaterial());
  colliderMesh.geometry.boundsTree = bvh;
  // Don't add colliderMesh to scene — it's an invisible raycast proxy.

  // --- Cone state and group ---
  const state: ConeState = {
    sides: 28,
    ringCount: 3,
    range: DEFAULT_PRESET.range,
    angle: DEFAULT_PRESET.angle,
    hitDistances: new Float32Array(28 + 1).fill(DEFAULT_PRESET.range),
  };

  const coneGroup = new THREE.Group();
  coneGroup.position.set(-7.5, 6.5, -7.5);
  scene.add(coneGroup);

  // Inner mesh — rotated +90° around X so its +Y axis points to the parent's +Z.
  // Note: Object3D.lookAt orients NON-camera objects so their local +Z points
  // toward the target (the opposite of Camera.lookAt). So we align mesh +Y
  // (apex→base direction) with parent +Z, not -Z.
  const coneMeshGroup = new THREE.Group();
  coneMeshGroup.rotation.x = Math.PI / 2;
  coneGroup.add(coneMeshGroup);

  // --- Depth render target (for soft intersection in the beam shader) ---
  const depthRT = new THREE.WebGLRenderTarget(initialW, initialH);
  depthRT.depthTexture = new THREE.DepthTexture(initialW, initialH);
  depthRT.depthTexture.format = THREE.DepthFormat;
  depthRT.depthTexture.type = THREE.UnsignedShortType;

  // --- Beam material with the ported shader ---
  const beamUniforms: Record<string, THREE.IUniform> = {
    uSceneDepth: { value: depthRT.depthTexture },
    uResolution: { value: new THREE.Vector2(initialW, initialH) },
    uCameraNear: { value: camera.near },
    uCameraFar: { value: camera.far },
    uTime: { value: 0 },
    uColorNear: { value: new THREE.Vector3(...DEFAULT_PRESET.colorNear) },
    uColorFar: { value: new THREE.Vector3(...DEFAULT_PRESET.colorFar) },
    uIntensity: { value: DEFAULT_PRESET.intensity },
    uEdgeSoftness: { value: DEFAULT_PRESET.edgeSoftness },
    uCoreSoftness: { value: DEFAULT_PRESET.coreSoftness },
    uCoreIntensity: { value: DEFAULT_PRESET.coreIntensity },
    uDistanceFalloff: { value: DEFAULT_PRESET.distanceFalloff },
    uHitFade: { value: DEFAULT_PRESET.hitFade },
    uDepthFade: { value: DEFAULT_PRESET.depthFade },
    uNoiseScale: { value: DEFAULT_PRESET.noiseScale },
    uNoiseSpeed: { value: DEFAULT_PRESET.noiseSpeed },
    uNoiseStrength: { value: DEFAULT_PRESET.noiseStrength },
    uFlickerSpeed: { value: DEFAULT_PRESET.flickerSpeed },
    uFlickerAmount: { value: DEFAULT_PRESET.flickerAmount },
    uStutterChance: { value: DEFAULT_PRESET.stutterChance },
    uStutterAmount: { value: DEFAULT_PRESET.stutterAmount },
  };

  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const coneMesh = new THREE.Mesh(buildConeGeometry(state), beamMaterial);
  coneMeshGroup.add(coneMesh);

  // --- Raycast direction + hit distance update (replaces Unity Job System) ---
  const tmpRayOrigin = new THREE.Vector3();
  const tmpRayDir = new THREE.Vector3();
  const ray = new THREE.Ray();
  const sideEpsilon = 0.05;
  let meshDirty = true;

  function castRays(): void {
    const halfAngleRad = (state.angle * 0.5 * Math.PI) / 180;
    const baseRadius = state.range * Math.tan(halfAngleRad);
    coneGroup.updateMatrixWorld(true);

    tmpRayOrigin.setFromMatrixPosition(coneGroup.matrixWorld);

    for (let i = 0; i <= state.sides; i++) {
      const t = i / state.sides;
      const radian = t * Math.PI * 2;
      const localDirX = Math.sin(radian) * baseRadius;
      const localDirZ = Math.cos(radian) * baseRadius;
      // Direction is in cone-mesh-local space (apex → ring point). Transform
      // it through the coneMeshGroup chain (which includes the parent group's
      // lookAt rotation) into world space.
      tmpRayDir.set(localDirX, state.range, localDirZ).normalize();
      tmpRayDir.transformDirection(coneMeshGroup.matrixWorld);

      ray.origin.copy(tmpRayOrigin);
      ray.direction.copy(tmpRayDir);

      let newDist = state.range;
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance < state.range) {
        newDist = Math.max(0, hit.distance - sideEpsilon);
      }

      // Snap toward target distance for snappy but smooth deformation.
      const smoothed = THREE.MathUtils.lerp(state.hitDistances[i], newDist, 0.25);
      if (Math.abs(smoothed - state.hitDistances[i]) > 0.005) {
        state.hitDistances[i] = smoothed;
        meshDirty = true;
      }
    }
  }

  function maybeRebuildMesh(): void {
    if (!meshDirty) return;
    const oldGeom = coneMesh.geometry;
    coneMesh.geometry = buildConeGeometry(state);
    oldGeom.dispose();
    meshDirty = false;
  }

  // --- Target tracking ---
  // Default: aim at the centre of the cube cluster so the beam shows wall
  // deformation immediately, before the user touches anything.
  const defaultTarget = new THREE.Vector3(0.8, 0, 0.6);
  const target = defaultTarget.clone();
  const desiredTarget = defaultTarget.clone();

  type Mode = 'camera' | 'beam';
  let mode: Mode = 'camera';

  function onPointerMove(ev: PointerEvent) {
    if (mode !== 'beam') return;
    const rect = canvasWrap.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const ndc = new THREE.Vector2(nx, ny);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, camera);
    const intersect = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (rc.ray.intersectPlane(plane, intersect)) {
      desiredTarget.copy(intersect);
    }
  }
  canvasWrap.addEventListener('pointermove', onPointerMove);

  function setMode(next: Mode): void {
    mode = next;
    controls.enabled = next === 'camera';
    canvasWrap.classList.toggle('sl-mode-beam', next === 'beam');
    root.querySelectorAll<HTMLButtonElement>('[data-sl-mode-btn]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.slModeBtn === next);
    });
  }

  function toggleMode(): void {
    setMode(mode === 'camera' ? 'beam' : 'camera');
  }

  // Middle-mouse click toggles control mode. Use auxclick for the actual
  // toggle (fires after a clean click), and preventDefault on mousedown to
  // suppress the browser's auto-scroll behavior on Windows.
  function onMouseDown(ev: MouseEvent) {
    if (ev.button === 1) ev.preventDefault();
  }
  function onAuxClick(ev: MouseEvent) {
    if (ev.button === 1) {
      ev.preventDefault();
      toggleMode();
    }
  }
  canvasWrap.addEventListener('mousedown', onMouseDown);
  canvasWrap.addEventListener('auxclick', onAuxClick);

  // --- Controls UI ---
  type SliderDef = {
    key: keyof Preset | 'range' | 'angle';
    label: string;
    min: number;
    max: number;
    step: number;
    onChange?: (v: number) => void;
  };

  const sliders: SliderDef[] = [
    { key: 'range', label: 'range', min: 1, max: 20, step: 0.5 },
    { key: 'angle', label: 'angle°', min: 10, max: 80, step: 1 },
    { key: 'intensity', label: 'intensity', min: 0.05, max: 3, step: 0.05 },
    { key: 'edgeSoftness', label: 'edge soft', min: 0.05, max: 4, step: 0.05 },
    { key: 'coreIntensity', label: 'core glow', min: 0, max: 2, step: 0.05 },
    { key: 'distanceFalloff', label: 'dist falloff', min: 0.5, max: 5, step: 0.1 },
    { key: 'hitFade', label: 'hit fade', min: 0, max: 0.5, step: 0.01 },
    { key: 'depthFade', label: 'depth soft', min: 0, max: 4, step: 0.05 },
    { key: 'noiseStrength', label: 'noise', min: 0, max: 0.5, step: 0.01 },
    { key: 'noiseSpeed', label: 'noise speed', min: 0, max: 2, step: 0.05 },
    { key: 'flickerAmount', label: 'flicker', min: 0, max: 0.1, step: 0.005 },
    { key: 'stutterAmount', label: 'stutter', min: 0, max: 0.5, step: 0.01 },
  ];

  function getInitial(key: string): number {
    if (key === 'range') return state.range;
    if (key === 'angle') return state.angle;
    const u = beamUniforms['u' + capitalize(key)];
    return (u?.value as number) ?? 0;
  }

  // Sliders
  const sliderElements: Record<string, { input: HTMLInputElement; label: HTMLElement }> = {};
  for (const def of sliders) {
    const initial = getInitial(def.key as string);
    const row = document.createElement('div');
    row.className = 'lab-control';
    row.innerHTML = `
      <label>${def.label} <span data-sl-label="${def.key}">${initial.toFixed(2)}</span></label>
      <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${initial}" data-sl-slider="${def.key}" />
    `;
    controlsWrap.appendChild(row);
    sliderElements[def.key as string] = {
      input: row.querySelector('input')!,
      label: row.querySelector('[data-sl-label]')!,
    };
  }

  function setUniformFromKey(key: string, value: number): void {
    const uniformName = 'u' + capitalize(key);
    if (uniformName in beamUniforms) {
      beamUniforms[uniformName].value = value;
    }
  }

  function setStateFromKey(key: string, value: number): boolean {
    if (key === 'range') {
      state.range = value;
      state.hitDistances.fill(value);
      meshDirty = true;
      return true;
    }
    if (key === 'angle') {
      state.angle = value;
      meshDirty = true;
      return true;
    }
    return false;
  }

  Object.entries(sliderElements).forEach(([key, { input, label }]) => {
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      label.textContent = v.toFixed(2);
      if (!setStateFromKey(key, v)) {
        setUniformFromKey(key, v);
      }
    });
  });

  function applyPreset(p: Preset): void {
    state.range = p.range;
    state.angle = p.angle;
    state.hitDistances.fill(p.range);
    meshDirty = true;
    (beamUniforms.uColorNear.value as THREE.Vector3).set(...p.colorNear);
    (beamUniforms.uColorFar.value as THREE.Vector3).set(...p.colorFar);
    beamUniforms.uIntensity.value = p.intensity;
    beamUniforms.uEdgeSoftness.value = p.edgeSoftness;
    beamUniforms.uCoreSoftness.value = p.coreSoftness;
    beamUniforms.uCoreIntensity.value = p.coreIntensity;
    beamUniforms.uDistanceFalloff.value = p.distanceFalloff;
    beamUniforms.uHitFade.value = p.hitFade;
    beamUniforms.uDepthFade.value = p.depthFade;
    beamUniforms.uNoiseScale.value = p.noiseScale;
    beamUniforms.uNoiseSpeed.value = p.noiseSpeed;
    beamUniforms.uNoiseStrength.value = p.noiseStrength;
    beamUniforms.uFlickerSpeed.value = p.flickerSpeed;
    beamUniforms.uFlickerAmount.value = p.flickerAmount;
    beamUniforms.uStutterChance.value = p.stutterChance;
    beamUniforms.uStutterAmount.value = p.stutterAmount;

    // Reflect into the sliders so UI matches.
    for (const def of sliders) {
      const ui = sliderElements[def.key as string];
      if (!ui) continue;
      const k = def.key as string;
      const v =
        k === 'range'
          ? p.range
          : k === 'angle'
            ? p.angle
            : ((p as unknown as Record<string, number>)[k] ?? parseFloat(ui.input.value));
      ui.input.value = String(v);
      ui.label.textContent = v.toFixed(2);
    }
  }

  applyPreset(DEFAULT_PRESET);

  // Mode toggle wiring (camera / beam control)
  root.querySelectorAll<HTMLButtonElement>('[data-sl-mode-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.slModeBtn as Mode));
  });
  setMode('camera');

  // --- Resize ---
  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    depthRT.setSize(w, h);
    (beamUniforms.uResolution.value as THREE.Vector2).set(w, h);
  });
  ro.observe(canvasWrap);

  // --- Render loop with pause-when-offscreen ---
  let running = true;
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.01 },
  );
  io.observe(root);

  const startMs = performance.now();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = (performance.now() - startMs) / 1000;
    beamUniforms.uTime.value = t;
    controls.update();

    // Aim cone at target (smooth approach so beam-mode tracking feels nice).
    target.lerp(desiredTarget, 0.18);
    coneGroup.lookAt(target);

    castRays();
    maybeRebuildMesh();

    // 1) render scene depth (cone hidden) to RT so beam shader can soft-intersect.
    coneMesh.visible = false;
    renderer.setRenderTarget(depthRT);
    renderer.render(scene, camera);

    // 2) render final colour pass with cone visible.
    coneMesh.visible = true;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
  tick();

  return () => {
    running = false;
    io.disconnect();
    ro.disconnect();
    controls.dispose();
    canvasWrap.removeEventListener('pointermove', onPointerMove);
    canvasWrap.removeEventListener('mousedown', onMouseDown);
    canvasWrap.removeEventListener('auxclick', onAuxClick);
    coneMesh.geometry.dispose();
    beamMaterial.dispose();
    depthRT.dispose();
    depthRT.depthTexture.dispose();
    colliderGeometry.dispose();
    floor.geometry.dispose();
    floorMat.dispose();
    wallMat.dispose();
    block1.geometry.dispose();
    block2.geometry.dispose();
    block3.geometry.dispose();
    block4.geometry.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
