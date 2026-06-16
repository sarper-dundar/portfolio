import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Viewer {
  dispose(): void;
}

function renderShell(root: HTMLElement, name: string): void {
  root.classList.add('mv');
  root.innerHTML = `
    <div class="mv-canvas" role="img" aria-label="${name} 3D viewer"></div>
    <div class="mv-overlay">
      <span class="mv-status">loading…</span>
      <span class="mv-name">${name}</span>
    </div>
    <div class="mv-controls">
      <div class="mv-control">
        <label>exposure <span data-mv-exposure-label>0.85</span></label>
        <input type="range" min="0.3" max="2.0" step="0.05" value="0.85" data-mv-exposure />
      </div>
      <div class="mv-control">
        <label>view</label>
        <div class="mv-segmented">
          <button type="button" data-mv-reset>reset</button>
          <button type="button" data-mv-wire>wireframe</button>
        </div>
      </div>
    </div>
  `;
}

async function mount(root: HTMLElement): Promise<Viewer> {
  const src = root.dataset.src ?? '';
  const name = root.dataset.name ?? 'Model';
  renderShell(root, name);

  const canvasWrap = root.querySelector('.mv-canvas') as HTMLElement;
  const statusEl = root.querySelector('.mv-status') as HTMLElement;

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
  scene.background = null;

  // IBL — same RoomEnvironment trick the material viewer uses so PBR
  // surfaces don't look "wet" from sharp directional spec only.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.05, 100);
  camera.position.set(0, 0, 3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const keyLight = new THREE.DirectionalLight(0xfff2dc, 0.6);
  keyLight.position.set(2.2, 2.0, 1.6);
  scene.add(keyLight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // ---- Load GLB ----
  const loader = new GLTFLoader();
  let model: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;

  const gltf = await loader.loadAsync(src).catch((err: unknown) => {
    console.error('Model load failed:', err);
    if (statusEl) statusEl.textContent = 'load failed';
    throw err;
  });

  model = gltf.scene;
  scene.add(model);

  // Auto-fit: center on origin, scale so the bounding sphere fits the frame.
  const box = new THREE.Box3().setFromObject(model);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const center = sphere.center;
  const radius = sphere.radius;
  model.position.sub(center);
  const targetRadius = 1.2;
  const scale = radius > 0 ? targetRadius / radius : 1;
  model.scale.multiplyScalar(scale);

  // Adjust camera + controls range for the scaled model.
  const distance = targetRadius * 2.6;
  camera.position.set(distance * 0.7, distance * 0.55, distance);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.minDistance = targetRadius * 1.2;
  controls.maxDistance = targetRadius * 8;
  controls.update();

  // Animations (play the first if any exist).
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();
  }

  if (statusEl) statusEl.textContent = '';

  // ---- Controls ----
  const exposureInput = root.querySelector('[data-mv-exposure]') as HTMLInputElement | null;
  const exposureLabel = root.querySelector('[data-mv-exposure-label]') as HTMLElement | null;
  const resetBtn = root.querySelector('[data-mv-reset]') as HTMLButtonElement | null;
  const wireBtn = root.querySelector('[data-mv-wire]') as HTMLButtonElement | null;

  exposureInput?.addEventListener('input', () => {
    const v = parseFloat(exposureInput.value);
    renderer.toneMappingExposure = v;
    if (exposureLabel) exposureLabel.textContent = v.toFixed(2);
  });

  resetBtn?.addEventListener('click', () => {
    camera.position.set(distance * 0.7, distance * 0.55, distance);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  let wireframe = false;
  wireBtn?.addEventListener('click', () => {
    wireframe = !wireframe;
    wireBtn.classList.toggle('is-active', wireframe);
    model?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as
          | THREE.MeshStandardMaterial
          | THREE.MeshStandardMaterial[];
        if (Array.isArray(m)) m.forEach((mm) => (mm.wireframe = wireframe));
        else m.wireframe = wireframe;
      }
    });
  });

  // ---- Resize ----
  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(canvasWrap);

  // ---- IO + RAF ----
  let running = true;
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.01 },
  );
  io.observe(root);

  let lastT = performance.now();
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;
    if (!visible) return;
    mixer?.update(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  return {
    dispose() {
      running = false;
      io.disconnect();
      ro.disconnect();
      controls.dispose();
      envRT.dispose();
      renderer.dispose();
      model?.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else (m as THREE.Material)?.dispose();
        }
      });
      renderer.domElement.remove();
    },
  };
}

const ACTIVE = new WeakMap<HTMLElement, Viewer>();

function mountAll(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-model-viewer]');
  roots.forEach((root) => {
    if (root.dataset.mvMounted === '1') return;
    root.dataset.mvMounted = '1';
    mount(root)
      .then((v) => ACTIVE.set(root, v))
      .catch(() => {
        root.dataset.mvMounted = '';
      });
  });
}

function disposeAll(): void {
  document.querySelectorAll<HTMLElement>('[data-model-viewer]').forEach((root) => {
    const v = ACTIVE.get(root);
    if (v) {
      v.dispose();
      ACTIVE.delete(root);
      root.dataset.mvMounted = '';
    }
  });
}

let listenersWired = false;
export function mountModelViewers(): void {
  mountAll();
  if (listenersWired) return;
  listenersWired = true;
  document.addEventListener('astro:page-load', mountAll);
  document.addEventListener('astro:before-swap', disposeAll);
}
