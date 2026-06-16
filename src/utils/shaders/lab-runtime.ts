import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface UniformSpec {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
}

export interface DemoConfig {
  id: string;
  vertex: string;
  fragment: string;
  uniforms: UniformSpec[];
  background?: string;
  cameraDistance?: number;
  cameraAngle?: number;
  extraUniforms?: Record<string, THREE.IUniform>;
  onMount?: (
    material: THREE.ShaderMaterial,
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
  ) => void | (() => void);
  sourceLanguage?: string;
  sourceLabel?: string;
  sourceText?: string;
}

const VERT_PLANE = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  vec4 mv = viewMatrix * worldPos4;
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const DEFAULT_PLANE_VERTEX = VERT_PLANE;

function fmt(v: number): string {
  return v.toFixed(2);
}

export function renderDemoShell(
  root: HTMLElement,
  cfg: {
    id: string;
    title: string;
    subtitle?: string;
    uniforms: UniformSpec[];
    sourceLabel?: string;
  },
) {
  root.classList.add('lab-demo');
  const controlsHtml = cfg.uniforms
    .map(
      (u) => `
      <div class="lab-control">
        <label>${u.label} <span data-uniform-label="${u.name}">${(u.format ?? fmt)(u.value)}</span></label>
        <input type="range" min="${u.min}" max="${u.max}" step="${u.step}" value="${u.value}" data-uniform="${u.name}" />
      </div>`,
    )
    .join('');

  root.innerHTML = `
    <header class="lab-header">
      <h3>${cfg.title}</h3>
      ${cfg.subtitle ? `<p>${cfg.subtitle}</p>` : ''}
    </header>
    <div class="lab-canvas"></div>
    <div class="lab-controls">${controlsHtml}</div>
    <details class="lab-source">
      <summary>${cfg.sourceLabel ?? 'view source'}</summary>
      <pre><code data-demo-source></code></pre>
    </details>
  `;
}

export async function mountDemo(root: HTMLElement, cfg: DemoConfig): Promise<() => void> {
  const canvasWrap = root.querySelector('.lab-canvas') as HTMLElement;
  const sourceEl = root.querySelector('[data-demo-source]') as HTMLElement | null;

  const initialW = Math.max(canvasWrap.clientWidth, 320);
  const initialH = Math.max(canvasWrap.clientHeight, 360);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;

  const dist = cfg.cameraDistance ?? 2.5;
  const angle = cfg.cameraAngle ?? Math.PI / 5;
  const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.05, 50);
  camera.position.set(0, dist * Math.sin(angle), dist * Math.cos(angle));
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 1.5;
  controls.maxDistance = 6;

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(initialW, initialH) },
    ...(cfg.extraUniforms ?? {}),
  };
  cfg.uniforms.forEach((u) => {
    uniforms[u.name] = { value: u.value };
  });

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: cfg.vertex,
    fragmentShader: cfg.fragment,
    side: THREE.DoubleSide,
  });

  const geom = new THREE.PlaneGeometry(2.4, 2.4, 1, 1);
  const mesh = new THREE.Mesh(geom, material);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  const cleanupExtra = cfg.onMount?.(material, mesh, scene, renderer);

  if (sourceEl) {
    sourceEl.textContent = cfg.sourceText ?? cfg.fragment;
  }

  // Slider wiring
  const sliders = root.querySelectorAll<HTMLInputElement>('[data-uniform]');
  sliders.forEach((slider) => {
    const name = slider.dataset.uniform!;
    const labelEl = root.querySelector(`[data-uniform-label="${name}"]`) as HTMLElement | null;
    const spec = cfg.uniforms.find((u) => u.name === name);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      uniforms[name].value = v;
      if (labelEl) labelEl.textContent = (spec?.format ?? fmt)(v);
    });
  });

  // Resize
  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    (uniforms.uResolution.value as THREE.Vector2).set(w, h);
  });
  ro.observe(canvasWrap);

  // IO + RAF
  let running = true;
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.01 },
  );
  io.observe(root);

  const start = performance.now();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible) return;
    uniforms.uTime.value = (performance.now() - start) / 1000;
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  return () => {
    running = false;
    io.disconnect();
    ro.disconnect();
    controls.dispose();
    if (typeof cleanupExtra === 'function') cleanupExtra();
    renderer.dispose();
    material.dispose();
    geom.dispose();
    renderer.domElement.remove();
  };
}
