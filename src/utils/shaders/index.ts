import { mountDemo, renderDemoShell, type DemoConfig, type UniformSpec } from './lab-runtime';
import { makeRipplesDemo } from './demo-ripples';
import { makePuddleDemo } from './demo-puddle';
import { makeTriplanarDemo } from './demo-triplanar';
import { mountSearchlight } from './demo-searchlight';
import { mountSurfaceTextPlacer } from './demo-surface-text';

interface DemoMeta {
  title: string;
  subtitle: string;
  make: () => DemoConfig;
}

const REGISTRY: Record<string, DemoMeta> = {
  ripples: {
    title: 'Rain Ripples',
    subtitle:
      'Voronoi-cell ripple shader, GLSL port of the Low Poly Wet Surfaces ' +
      'Custom Function. Drag to orbit.',
    make: makeRipplesDemo,
  },
  puddle: {
    title: 'Puddle Mask',
    subtitle:
      'Two-layer gradient noise × smoothstep, world-XZ projection with ' +
      'surface-angle mask. Tilt to see the angle clamp.',
    make: makePuddleDemo,
  },
  triplanar: {
    title: 'Four-face Triplanar',
    subtitle:
      'Custom cylindrical triplanar with separate bottom sampling — the ' +
      'Synty / Area58 rebuild, ported. Procedural moss/rock/soil textures.',
    make: makeTriplanarDemo,
  },
};

// Custom demos that don't fit the shader-on-plane scaffolding (e.g. the
// searchlight needs its own scene + raycasts). Their mount function
// returns a dispose handle directly.
const CUSTOM_DEMOS: Record<string, (root: HTMLElement) => () => void> = {
  searchlight: mountSearchlight,
  'surface-text': mountSurfaceTextPlacer,
};

const ACTIVE = new WeakMap<HTMLElement, () => void>();

function mountAll(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-lab-demo]');
  roots.forEach((root) => {
    if (root.dataset.labMounted === '1') return;
    const id = root.dataset.labDemo;
    if (!id) return;

    if (CUSTOM_DEMOS[id]) {
      root.dataset.labMounted = '1';
      try {
        const dispose = CUSTOM_DEMOS[id](root);
        ACTIVE.set(root, dispose);
      } catch (err) {
        console.error(`[lab/${id}] mount failed`, err);
        root.dataset.labMounted = '';
      }
      return;
    }

    if (!REGISTRY[id]) return;
    root.dataset.labMounted = '1';
    const meta = REGISTRY[id];
    const cfg = meta.make();
    renderDemoShell(root, {
      id,
      title: meta.title,
      subtitle: meta.subtitle,
      uniforms: cfg.uniforms as UniformSpec[],
      sourceLabel: cfg.sourceLabel,
    });
    mountDemo(root, cfg)
      .then((dispose) => ACTIVE.set(root, dispose))
      .catch((err) => {
        console.error(`[lab/${id}] mount failed`, err);
        root.dataset.labMounted = '';
      });
  });
}

function disposeAll(): void {
  document.querySelectorAll<HTMLElement>('[data-lab-demo]').forEach((root) => {
    const dispose = ACTIVE.get(root);
    if (dispose) {
      dispose();
      ACTIVE.delete(root);
      root.dataset.labMounted = '';
    }
  });
}

let listenersWired = false;
export function mountLabDemos(): void {
  mountAll();
  if (listenersWired) return;
  listenersWired = true;
  document.addEventListener('astro:page-load', mountAll);
  document.addEventListener('astro:before-swap', disposeAll);
}
