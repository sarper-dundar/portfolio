import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type MapKey = 'basecolor' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'height';
type MeshKind = 'sphere' | 'plane' | 'cube';

const ALL_MAPS: MapKey[] = ['basecolor', 'normal', 'roughness', 'metallic', 'ao', 'height'];

interface Viewer {
  dispose(): void;
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
  sRGB: boolean,
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        tex.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

function renderShell(
  root: HTMLElement,
  slug: string,
  name: string,
  mesh: MeshKind,
  defaultTiles: number,
) {
  root.classList.add('mv');
  root.innerHTML = `
    <div class="mv-canvas" role="img" aria-label="${name} material viewer"></div>
    <div class="mv-overlay">
      <span class="mv-status">loading…</span>
      <span class="mv-name">${name}</span>
    </div>
    <div class="mv-controls">
      <div class="mv-control">
        <label>shape</label>
        <div class="mv-segmented" role="tablist">
          <button type="button" data-mv-mesh="sphere">sphere</button>
          <button type="button" data-mv-mesh="plane">plane</button>
          <button type="button" data-mv-mesh="cube">cube</button>
        </div>
      </div>
      <div class="mv-control">
        <label>tile <span data-mv-tiles-label>${defaultTiles.toFixed(1)}×</span></label>
        <input type="range" min="0.5" max="6" step="0.1" value="${defaultTiles}" data-mv-tiles />
      </div>
      <div class="mv-control">
        <label>height <span data-mv-displacement-label>0.00</span></label>
        <input type="range" min="0" max="0.2" step="0.005" value="0" data-mv-displacement />
      </div>
      <div class="mv-control">
        <label>exposure <span data-mv-exposure-label>0.70</span></label>
        <input type="range" min="0.4" max="2.2" step="0.05" value="0.7" data-mv-exposure />
      </div>
    </div>
  `;
  void mesh;
}

async function mount(root: HTMLElement): Promise<Viewer> {
  const slug = root.dataset.slug ?? '';
  const name = root.dataset.name ?? slug.replace(/-/g, ' ');
  const mapsAttr = root.dataset.maps ?? 'basecolor,normal,roughness,ao';
  const meshAttr = (root.dataset.mesh as MeshKind) ?? 'sphere';
  const tilesAttr = parseFloat(root.dataset.tiles ?? '2');

  const requested = mapsAttr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALL_MAPS.includes(s as MapKey)) as MapKey[];

  renderShell(root, slug, name, meshAttr, tilesAttr);

  const canvasWrap = root.querySelector('.mv-canvas') as HTMLElement;
  const statusEl = root.querySelector('.mv-status') as HTMLElement;

  // Sizing — force at least 360px height if container collapsed
  const initialW = Math.max(canvasWrap.clientWidth, 320);
  const initialH = Math.max(canvasWrap.clientHeight, 360);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;

  // Image-based lighting from a procedural room env. Without this PBR
  // looks broken: rough surfaces still get sharp directional-light spec
  // hotspots and read as "wet" regardless of the roughness map. With it,
  // roughness actually drives how blurry the reflection is — matte stays
  // matte, polished stays polished.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, initialW / initialH, 0.05, 50);
  camera.position.set(0, 0, 3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 8;

  // Low-intensity directional just for surface-shape modulation; IBL
  // does the heavy lifting now.
  const keyLight = new THREE.DirectionalLight(0xfff2dc, 0.7);
  keyLight.position.set(2.2, 2.0, 1.6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x88a0c4, 0.25);
  fillLight.position.set(-2.2, 1.0, -0.8);
  scene.add(fillLight);

  // Load textures concurrently
  if (statusEl) statusEl.textContent = 'loading…';
  const loader = new THREE.TextureLoader();
  const texPromises = await Promise.all(
    requested.map(async (map) => {
      const url = `/materials/${slug}/${map}.webp`;
      try {
        const tex = await loadTexture(loader, url, map === 'basecolor');
        return [map, tex] as const;
      } catch {
        return [map, null] as const;
      }
    }),
  );
  const textures = Object.fromEntries(texPromises) as Partial<Record<MapKey, THREE.Texture>>;
  // Briefly show which maps actually loaded so missing roughness/metallic
  // is visible at a glance rather than guessed at.
  if (statusEl) {
    const loaded = Object.entries(textures)
      .filter(([, t]) => !!t)
      .map(([k]) => k)
      .join(' · ');
    const missing = requested.filter((m) => !textures[m]);
    statusEl.textContent =
      (loaded ? loaded : 'no maps') + (missing.length ? ` (missing: ${missing.join(', ')})` : '');
    setTimeout(() => {
      if (statusEl) statusEl.textContent = '';
    }, 4500);
  }

  const tileTextures = (n: number) => {
    for (const t of Object.values(textures)) {
      if (!t) continue;
      t.repeat.set(n, n);
      t.needsUpdate = true;
    }
  };
  tileTextures(tilesAttr);

  const material = new THREE.MeshStandardMaterial({
    map: textures.basecolor ?? null,
    normalMap: textures.normal ?? null,
    roughnessMap: textures.roughness ?? null,
    metalnessMap: textures.metallic ?? null,
    aoMap: textures.ao ?? null,
    displacementMap: textures.height ?? null,
    displacementScale: 0.0,
    roughness: textures.roughness ? 1.0 : 0.85,
    metalness: textures.metallic ? 1.0 : 0.0,
    aoMapIntensity: 1.0,
    normalScale: new THREE.Vector2(1, 1),
  });

  let mesh: THREE.Mesh | null = null;
  let currentKind: MeshKind = meshAttr;

  function buildGeometry(kind: MeshKind): THREE.BufferGeometry {
    if (kind === 'plane') return new THREE.PlaneGeometry(2.4, 2.4, 200, 200);
    if (kind === 'cube') return new THREE.BoxGeometry(1.6, 1.6, 1.6, 64, 64, 64);
    return new THREE.SphereGeometry(1.1, 96, 96);
  }

  function rebuildMesh(kind: MeshKind) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    const geom = buildGeometry(kind);
    if (geom.attributes.uv && !geom.attributes.uv2) {
      geom.setAttribute('uv2', geom.attributes.uv);
    }
    mesh = new THREE.Mesh(geom, material);
    if (kind === 'plane') {
      mesh.rotation.x = -Math.PI / 6;
    }
    scene.add(mesh);
    currentKind = kind;
  }

  rebuildMesh(meshAttr);

  // ----- Controls wiring -----
  const tilesInput = root.querySelector('[data-mv-tiles]') as HTMLInputElement | null;
  const tilesLabel = root.querySelector('[data-mv-tiles-label]') as HTMLElement | null;
  const dispInput = root.querySelector('[data-mv-displacement]') as HTMLInputElement | null;
  const dispLabel = root.querySelector('[data-mv-displacement-label]') as HTMLElement | null;
  const exposureInput = root.querySelector('[data-mv-exposure]') as HTMLInputElement | null;
  const exposureLabel = root.querySelector('[data-mv-exposure-label]') as HTMLElement | null;
  const meshButtons = root.querySelectorAll<HTMLButtonElement>('[data-mv-mesh]');

  tilesInput?.addEventListener('input', () => {
    const n = parseFloat(tilesInput.value);
    if (tilesLabel) tilesLabel.textContent = n.toFixed(1) + '×';
    tileTextures(n);
  });

  dispInput?.addEventListener('input', () => {
    const v = parseFloat(dispInput.value);
    material.displacementScale = v;
    if (dispLabel) dispLabel.textContent = v.toFixed(2);
  });

  exposureInput?.addEventListener('input', () => {
    const v = parseFloat(exposureInput.value);
    renderer.toneMappingExposure = v;
    if (exposureLabel) exposureLabel.textContent = v.toFixed(2);
  });

  meshButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.mvMesh as MeshKind;
      if (kind === currentKind) return;
      meshButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      rebuildMesh(kind);
    });
    if (btn.dataset.mvMesh === meshAttr) btn.classList.add('is-active');
  });

  // ----- Resize observer -----
  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(canvasWrap);

  // ----- Render loop, paused while off-screen -----
  let running = true;
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.01 },
  );
  io.observe(root);

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible) return;
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
      Object.values(textures).forEach((t) => t?.dispose());
      material.dispose();
      mesh?.geometry.dispose();
      renderer.domElement.remove();
    },
  };
}

const ACTIVE = new WeakMap<HTMLElement, Viewer>();

function mountAll(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-material-viewer]');
  roots.forEach((root) => {
    if (root.dataset.mvMounted === '1') return;
    root.dataset.mvMounted = '1';
    mount(root)
      .then((v) => ACTIVE.set(root, v))
      .catch((err) => {
        console.error('MaterialViewer mount failed:', err);
        root.dataset.mvMounted = '';
        const status = root.querySelector('.mv-status');
        if (status) status.textContent = 'viewer failed to load';
      });
  });
}

function disposeAll(): void {
  document.querySelectorAll<HTMLElement>('[data-material-viewer]').forEach((root) => {
    const viewer = ACTIVE.get(root);
    if (viewer) {
      viewer.dispose();
      ACTIVE.delete(root);
      root.dataset.mvMounted = '';
    }
  });
}

let listenersWired = false;
export function mountMaterialViewers(): void {
  mountAll();
  if (listenersWired) return;
  listenersWired = true;
  // Astro view transitions: re-mount on every page load, dispose before swap.
  document.addEventListener('astro:page-load', mountAll);
  document.addEventListener('astro:before-swap', disposeAll);
}
