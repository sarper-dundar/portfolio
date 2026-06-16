import * as THREE from 'three';
import { DEFAULT_PLANE_VERTEX, type DemoConfig } from './lab-runtime';

const fragment = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;

uniform float uTime;
uniform vec2  uResolution;
uniform float uCellDensity;
uniform float uSpeed;
uniform float uStrength;
uniform float uWaveCount;
uniform float uSharpness;
uniform float uAngleOffset;
uniform float uTint;

// Dot-based hash (Inigo Quilez style) — cleaner than the original HLSL matrix
// hash, no banding. Then the same sin/cos twist for the angle offset that
// gave the original its drop-direction variation.
vec2 voronoi_random(vec2 p, float offset) {
  vec2 h = vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  );
  h = fract(sin(h) * 43758.5453);
  return vec2(
    sin(h.y * offset) * 0.5 + 0.5,
    cos(h.x * offset) * 0.5 + 0.5
  );
}

// Ripples — same algorithm as the original Unity Ripples_float Custom
// Function. The strength-before-normalize fix is applied (line 38 in
// the original source) so the strength slider actually changes intensity.
void ripples(
  vec2 UV,
  float angleOffset,
  float cellDensity,
  float time,
  float strength,
  float waveCount,
  float sharpness,
  out float outHeight,
  out vec3  outNormal
) {
  vec2 g = floor(UV * cellDensity);
  vec2 f = fract(UV * cellDensity);

  outHeight = 0.0;
  outNormal = vec3(0.0, 0.0, 1.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 lattice = vec2(float(x), float(y));
      vec2 offset = voronoi_random(mod(lattice + g, cellDensity), angleOffset);
      offset = offset * 0.6 + 0.2;
      float d = distance(lattice + offset, f);
      // Cutoff: original Cyanilux trick — skip ripples that have expanded
      // past their cell. Without this, ripples bleed across boundaries.
      if (d > 0.35) continue;
      float t = fract(time + (offset.x * 5.0));
      // Ripple shape: (1-d)^2 falloff × thin-ring mask^sharpness × sine
      d = (1.0 - d) * (1.0 - d)
        * pow(clamp(1.0 - abs(d - t), 0.0, 1.0), sharpness)
        * sin((d - t) * waveCount);
      outHeight = max(outHeight, -d);
      outNormal += d * normalize(vec3(normalize((lattice + offset).xy - f), 3.0));
    }
  }
  outNormal = normalize(outNormal);
  outNormal = normalize(vec3(outNormal.x * strength, outNormal.y * strength, outNormal.z));
}

void main() {
  // World-space UV so ripples stay locked to the plane regardless of
  // mesh UVs — same reasoning as the original puddle world-XZ trick.
  vec2 UV = vWorldPos.xz * 0.5;
  float ripple;
  vec3 N_t;
  ripples(UV, uAngleOffset, uCellDensity, uTime * uSpeed, uStrength, uWaveCount, uSharpness, ripple, N_t);

  // Tangent space → world space for a flat horizontal plane
  // (tangent x → world x, tangent y → world z, tangent z → world y)
  vec3 N = normalize(vec3(N_t.x, N_t.z, N_t.y));

  // Wet asphalt-ish base: dark, slightly tinted, very glossy.
  vec3 albedo = mix(vec3(0.03, 0.04, 0.05), vec3(0.12, 0.10, 0.09), uTint);

  // One key light from up-side; rim from opposite.
  vec3 lightDir = normalize(vec3(0.5, 0.9, 0.3));
  vec3 viewDir  = normalize(cameraPosition - vWorldPos);
  vec3 halfDir  = normalize(lightDir + viewDir);

  float diff = max(dot(N, lightDir), 0.0);
  float spec = pow(max(dot(N, halfDir), 0.0), 96.0);
  float rim  = pow(1.0 - max(dot(N, viewDir), 0.0), 3.0) * 0.4;

  vec3 sky = vec3(0.55, 0.62, 0.78);
  vec3 ground = vec3(0.12, 0.10, 0.08);
  vec3 ambient = mix(ground, sky, N.y * 0.5 + 0.5) * 0.35;

  vec3 col = albedo * (ambient + diff * vec3(1.0, 0.95, 0.85));
  col += spec * vec3(1.0, 0.97, 0.9) * 1.8;
  col += rim * vec3(0.5, 0.6, 0.75);

  // Brighten ripple crests slightly so they read on a dark surface.
  col += ripple * 0.6 * vec3(0.9, 0.95, 1.0);

  // Tone — soft clamp
  col = col / (col + vec3(1.0));
  col = pow(col, vec3(1.0 / 2.2));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function makeRipplesDemo(): DemoConfig {
  return {
    id: 'ripples',
    vertex: DEFAULT_PLANE_VERTEX,
    fragment,
    uniforms: [
      { name: 'uCellDensity', label: 'cells', min: 2, max: 16, step: 1, value: 8 },
      { name: 'uSpeed', label: 'speed', min: 0, max: 3, step: 0.05, value: 1 },
      { name: 'uStrength', label: 'strength', min: 0, max: 6, step: 0.05, value: 2.5 },
      { name: 'uWaveCount', label: 'waves', min: 1, max: 16, step: 0.5, value: 8 },
      { name: 'uSharpness', label: 'sharpness', min: 1, max: 12, step: 0.5, value: 4 },
      { name: 'uAngleOffset', label: 'twist', min: 1, max: 12, step: 0.1, value: 6 },
      { name: 'uTint', label: 'tint', min: 0, max: 1, step: 0.01, value: 0.35 },
    ],
    sourceLanguage: 'glsl',
    sourceLabel: 'view GLSL source',
    sourceText: fragment.trim(),
    cameraDistance: 2.6,
    cameraAngle: Math.PI / 6,
    onMount(material, mesh, scene, _renderer) {
      void material;
      void scene;
      void _renderer;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(3.2, 3.2, 1, 1);
      mesh.rotation.x = -Math.PI / 2;
    },
  };
}
