import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

// Surface Text Placer — interactive web mirror of the Unity tool. Click any
// mesh, the typed text lands at the click point oriented to the surface
// normal. Uses three.js DecalGeometry so the text conforms to curved
// surfaces instead of floating as a flat sprite — that's the part of the
// Unity tool that's hard to convey in screenshots.

function makeTextTexture(
  text: string,
  color: string,
): {
  texture: THREE.CanvasTexture;
  aspect: number;
} {
  const canvas = document.createElement('canvas');
  const padX = 32;
  const padY = 18;
  const fontPx = 96;
  // Measure first
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontPx}px 'Maple Mono', ui-monospace, monospace`;
  const w = Math.max(64, Math.ceil(ctx.measureText(text || ' ').width));
  canvas.width = w + padX * 2;
  canvas.height = fontPx + padY * 2;
  // Re-set context state (canvas resize wipes it)
  const ctx2 = canvas.getContext('2d')!;
  ctx2.clearRect(0, 0, canvas.width, canvas.height);
  ctx2.font = `${fontPx}px 'Maple Mono', ui-monospace, monospace`;
  ctx2.textBaseline = 'middle';
  ctx2.textAlign = 'center';
  ctx2.fillStyle = color;
  ctx2.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return { texture: tex, aspect: canvas.width / canvas.height };
}

export function mountSurfaceTextPlacer(root: HTMLElement): () => void {
  root.classList.add('lab-demo', 'lab-demo-stp');
  root.innerHTML = `
    <header class="lab-header">
      <h3>Surface Text Placer — interactive</h3>
      <p>
        Type a phrase, click any surface in the scene below. The inscription
        lands at the click point, oriented to the surface normal. Same idea
        as the Unity editor tool, ported to the web with three.js
        <code>DecalGeometry</code> so it conforms to curves the way a real
        decal does.
      </p>
    </header>
    <div class="lab-canvas" data-stp-canvas>
      <div class="stp-toolbar">
        <input type="text" data-stp-input value="Sarper" maxlength="24" spellcheck="false" />
        <label class="stp-size">
          size <span data-stp-size-label>0.55</span>
          <input type="range" min="0.18" max="1.4" step="0.02" value="0.55" data-stp-size />
        </label>
        <label class="stp-color">
          color
          <input type="color" value="#fdf3d8" data-stp-color />
        </label>
        <button type="button" data-stp-clear>clear</button>
      </div>
      <div class="stp-hint" data-stp-hint>click any surface to place text</div>
    </div>
  `;

  const canvasWrap = root.querySelector('[data-stp-canvas]') as HTMLElement;
  const input = root.querySelector('[data-stp-input]') as HTMLInputElement;
  const sizeInput = root.querySelector('[data-stp-size]') as HTMLInputElement;
  const sizeLabel = root.querySelector('[data-stp-size-label]') as HTMLElement;
  const colorInput = root.querySelector('[data-stp-color]') as HTMLInputElement;
  const clearBtn = root.querySelector('[data-stp-clear]') as HTMLButtonElement;
  const hintEl = root.querySelector('[data-stp-hint]') as HTMLElement;

  const initialW = Math.max(canvasWrap.clientWidth, 320);
  const initialH = Math.max(canvasWrap.clientHeight, 420);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, initialW / initialH, 0.1, 50);
  camera.position.set(4.2, 3.4, 5.0);
  camera.lookAt(0, 0.6, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0.6, 0);
  controls.minDistance = 3;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.49;

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
  key.position.set(3, 5, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8aa3c8, 0.45);
  fill.position.set(-3, 2, -1);
  scene.add(fill);

  // Soft env so PBR surfaces don't look plasticky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(
    new THREE.Scene().add(new THREE.HemisphereLight(0xeae4d8, 0x1a1a22, 1.0)),
    0.04,
  );
  scene.environment = env.texture;
  pmrem.dispose();

  // Materials
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x4b4d52,
    roughness: 0.7,
    metalness: 0.05,
  });

  // Targets — the meshes the user can place decals on
  const targets: THREE.Mesh[] = [];

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), surfaceMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  targets.push(floor);

  // Pillar (cylinder)
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 48, 1), surfaceMat);
  pillar.position.set(-1.6, 1.1, -0.6);
  scene.add(pillar);
  targets.push(pillar);

  // Sphere
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), surfaceMat);
  sphere.position.set(1.3, 0.9, 0.8);
  scene.add(sphere);
  targets.push(sphere);

  // Slab — angled block, gives a flat sloped surface
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.2), surfaceMat);
  slab.position.set(0.2, 0.35, -1.7);
  slab.rotation.set(-0.15, 0.4, 0.1);
  scene.add(slab);
  targets.push(slab);

  // Torus knot — the curved-surface stress test
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.42, 0.13, 96, 16), surfaceMat);
  knot.position.set(-0.4, 1.3, 1.6);
  scene.add(knot);
  targets.push(knot);

  // --- Decal management ---
  const decals: THREE.Mesh[] = [];

  function placeDecal(target: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3) {
    const text = input.value.trim() || 'Sarper';
    const sizeBase = parseFloat(sizeInput.value);
    const color = colorInput.value;
    const { texture, aspect } = makeTextTexture(text, color);

    // DecalGeometry wants:
    //   mesh,       — the target geometry
    //   position,   — world position
    //   orientation,— Euler rotation; we derive from the normal
    //   size,       — Vector3 (x = projection X, y = projection Y, z = depth)
    const orientation = new THREE.Euler();
    const dummy = new THREE.Object3D();
    dummy.position.copy(point);
    // Aim the dummy +Z along the surface normal so DecalGeometry projects
    // along the surface direction. lookAt(point + normal) does that.
    const lookTarget = point.clone().add(normal);
    dummy.lookAt(lookTarget);
    orientation.copy(dummy.rotation);

    const sizeVec = new THREE.Vector3(sizeBase * aspect, sizeBase, sizeBase * 1.6);

    const decalGeom = new DecalGeometry(target, point, orientation, sizeVec);
    const decalMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.45,
      metalness: 0.0,
    });
    const decalMesh = new THREE.Mesh(decalGeom, decalMat);
    scene.add(decalMesh);
    decals.push(decalMesh);
    hintEl.style.opacity = '0';
  }

  function clearDecals() {
    for (const d of decals) {
      scene.remove(d);
      d.geometry.dispose();
      (d.material as THREE.MeshStandardMaterial).map?.dispose();
      (d.material as THREE.MeshStandardMaterial).dispose();
    }
    decals.length = 0;
    hintEl.style.opacity = '1';
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function onCanvasClick(ev: MouseEvent) {
    if (ev.button !== 0) return;
    const rect = canvasWrap.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return;
    const hit = hits[0];
    if (!hit.face) return;
    // Transform the face normal to world space.
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
    placeDecal(hit.object as THREE.Mesh, hit.point, worldNormal);
  }
  // We listen to "click" not "pointerdown" so drag-orbit doesn't accidentally
  // place a decal at the end of an orbit drag. A click only fires if there's
  // no significant drag between mousedown and mouseup.
  renderer.domElement.addEventListener('click', onCanvasClick);

  // Toolbar wiring
  sizeInput.addEventListener('input', () => {
    sizeLabel.textContent = parseFloat(sizeInput.value).toFixed(2);
  });
  clearBtn.addEventListener('click', () => clearDecals());

  // Resize
  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  return () => {
    running = false;
    io.disconnect();
    ro.disconnect();
    controls.dispose();
    renderer.domElement.removeEventListener('click', onCanvasClick);
    clearDecals();
    floor.geometry.dispose();
    pillar.geometry.dispose();
    sphere.geometry.dispose();
    slab.geometry.dispose();
    knot.geometry.dispose();
    surfaceMat.dispose();
    env.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
