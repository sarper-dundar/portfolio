import * as THREE from 'three';
import { type DemoConfig } from './lab-runtime';

const vertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`;

const fragment = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

uniform sampler2D uTopMap;
uniform sampler2D uSideMap;
uniform sampler2D uBottomMap;
uniform float uTime;
uniform float uBlendSharpness;
uniform float uScale;
uniform float uSeparateBottom;

// Four-face cylindrical triplanar — same idea as the Synty / Area58 rebuild:
// instead of standard three-face triplanar (top + 2 sides), the surface
// normal's Y axis is split into separate positive and negative weights so
// "down" can sample a different texture than "up".
//
// Original Shader Graph triplanar node can't do this — it had to be built
// manually. The epsilon below is the GPU-precision fix Sarper found in
// the Synty source: dividing tiny weights by each other causes precision
// loss; +1e-5 keeps the math stable.

vec4 triplanar(vec3 worldPos, vec3 normal, float scale, float sharpness, float separateBottom) {
  vec3 absN = abs(normal);

  // Standard three-face triplanar weights, raised to a power for sharper seams.
  vec3 weights = pow(absN, vec3(sharpness));

  // Split Y into + and − so we can sample a separate bottom texture.
  float wTop    = max( normal.y, 0.0);
  float wBottom = max(-normal.y, 0.0);
  wTop    = pow(wTop,    sharpness);
  wBottom = pow(wBottom, sharpness);

  // Re-normalise. Without the +1e-5 the tiny weights divided by each
  // other produce a blurry rectangular patch instead of a clean round
  // cap (this is the Synty epsilon fix from area58.md).
  float wSide = pow(absN.x + absN.z, sharpness);
  float total = wTop + wBottom * separateBottom + wSide + 1e-5;
  float kTop    = wTop / total;
  float kBottom = (wBottom * separateBottom) / total;
  float kSide   = wSide / total;

  // Sample sides by projecting along world axes — for a vertical-ish
  // face dominated by world X, sample by yz; for one dominated by Z,
  // sample by xy. Blend the two side projections by their absolute X/Z.
  vec2 uvX = worldPos.zy * scale;
  vec2 uvZ = worldPos.xy * scale;
  vec2 uvTop    = worldPos.xz * scale;
  vec2 uvBottom = worldPos.xz * scale;

  vec4 sideX = texture2D(uSideMap, uvX);
  vec4 sideZ = texture2D(uSideMap, uvZ);
  // Re-weight side projections internally to avoid a hard seam.
  float sx = absN.x / (absN.x + absN.z + 1e-5);
  vec4 side = mix(sideZ, sideX, sx);

  vec4 top    = texture2D(uTopMap,    uvTop);
  vec4 bottom = texture2D(uBottomMap, uvBottom);

  return top * kTop + bottom * kBottom + side * kSide;
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec4 albedo = triplanar(vWorldPos, N, uScale, uBlendSharpness, uSeparateBottom);

  // Quick toon-ish lambert just so the geometry reads.
  vec3 lightDir = normalize(vec3(0.5, 0.9, 0.3));
  vec3 viewDir  = normalize(cameraPosition - vWorldPos);
  float diff = max(dot(N, lightDir), 0.0);
  float fres = pow(1.0 - max(dot(N, viewDir), 0.0), 2.0);
  vec3 ambient = vec3(0.32, 0.34, 0.36);
  vec3 col = albedo.rgb * (ambient + diff * 0.85);
  col += fres * 0.08;

  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
  if (uTime < -1e6) discard;
}
`;

// Generate three procedural surface textures so we don't ship a fourth
// material set — keeps page weight down. Moss for top, rock for sides,
// soil for bottom.
function makeProceduralTexture(kind: 'moss' | 'rock' | 'soil'): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  function rand(x: number, y: number, seed: number) {
    return (((Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453) % 1) + 1) % 1;
  }
  function smoothNoise(x: number, y: number, seed: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const r00 = rand(xi, yi, seed);
    const r10 = rand(xi + 1, yi, seed);
    const r01 = rand(xi, yi + 1, seed);
    const r11 = rand(xi + 1, yi + 1, seed);
    return (1 - u) * (1 - v) * r00 + u * (1 - v) * r10 + (1 - u) * v * r01 + u * v * r11;
  }
  function fbm(x: number, y: number, seed: number, octaves = 4): number {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      v += smoothNoise(x * f, y * f, seed + i) * amp;
      amp *= 0.5;
      f *= 2;
    }
    return v;
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * 8;
      const fy = (y / N) * 8;
      let r = 0;
      let g = 0;
      let b = 0;
      if (kind === 'moss') {
        const t = fbm(fx, fy, 1.3);
        const v = fbm(fx * 2.0, fy * 2.0, 4.7) * 0.5;
        r = 40 + t * 60 + v * 30;
        g = 90 + t * 120 + v * 30;
        b = 30 + t * 50;
      } else if (kind === 'rock') {
        const t = fbm(fx * 1.5, fy * 1.5, 7.1);
        const cracks = Math.pow(Math.abs(fbm(fx * 4.0, fy * 4.0, 3.3) - 0.5) * 2.0, 3.0);
        const base = 70 + t * 90 - cracks * 40;
        r = base + 14;
        g = base + 8;
        b = base;
      } else {
        const t = fbm(fx * 1.2, fy * 1.2, 9.5);
        const grit = fbm(fx * 5.0, fy * 5.0, 2.2) * 0.4;
        r = 65 + t * 70 + grit * 20;
        g = 40 + t * 50 + grit * 15;
        b = 20 + t * 30 + grit * 8;
      }
      const i = (y * N + x) * 4;
      data[i + 0] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function makeTriplanarDemo(): DemoConfig {
  const topMap = makeProceduralTexture('moss');
  const sideMap = makeProceduralTexture('rock');
  const bottomMap = makeProceduralTexture('soil');

  return {
    id: 'triplanar',
    vertex,
    fragment,
    uniforms: [
      { name: 'uBlendSharpness', label: 'blend sharpness', min: 1, max: 16, step: 0.5, value: 5 },
      { name: 'uScale', label: 'tile', min: 0.2, max: 4, step: 0.1, value: 1.4 },
      { name: 'uSeparateBottom', label: 'split bottom', min: 0, max: 1, step: 0.01, value: 1.0 },
    ],
    extraUniforms: {
      uTopMap: { value: topMap },
      uSideMap: { value: sideMap },
      uBottomMap: { value: bottomMap },
    },
    sourceLanguage: 'glsl',
    sourceLabel: 'view GLSL source',
    sourceText: fragment.trim(),
    cameraDistance: 3.5,
    cameraAngle: Math.PI / 4,
    onMount(_material, mesh) {
      mesh.geometry.dispose();
      const geom = new THREE.IcosahedronGeometry(1.1, 6);
      mesh.geometry = geom;
      mesh.rotation.set(0, 0, 0);

      // Slow auto-rotate so the seams sweep across the silhouette.
      let raf = 0;
      const start = performance.now();
      const animate = () => {
        const t = (performance.now() - start) / 1000;
        mesh.rotation.y = t * 0.15;
        mesh.rotation.x = Math.sin(t * 0.1) * 0.2;
        raf = requestAnimationFrame(animate);
      };
      animate();
      return () => {
        cancelAnimationFrame(raf);
        topMap.dispose();
        sideMap.dispose();
        bottomMap.dispose();
      };
    },
  };
}
