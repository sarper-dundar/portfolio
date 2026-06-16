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
uniform float uPuddleScale;
uniform float uPuddleEdge;
uniform float uWetness;
uniform float uAngleMask;
uniform float uTilt;
uniform float uTint;

// Gradient noise — classic Inigo Quilez. Same family as Unity's Gradient
// Noise node so the visual matches what the Substance / Shader Graph
// version produces.
vec2 noise_hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float gradient_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(noise_hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(noise_hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(noise_hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(noise_hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y) * 0.5 + 0.5;
}

void main() {
  // World XZ projection — puddles stay locked in space regardless of mesh
  // UVs. Without this, puddles smear on vertical / tilted surfaces.
  vec2 worldUV = vWorldPos.xz;

  // Two layered noise scales multiplied → organic puddle shapes
  // (same trick as the Unity subgraph in wet-surfaces.md).
  float large = gradient_noise(worldUV * uPuddleScale);
  float small = gradient_noise(worldUV * uPuddleScale * 3.7 + 11.0);
  float mask  = large * small;
  // Smoothstep gives clean edges instead of the noise's soft falloff.
  mask = smoothstep(0.18, 0.18 + uPuddleEdge, mask);

  // Surface-angle mask: clamp puddles to up-facing surfaces. Without this,
  // the world-XZ projection samples a 1D slice on vertical surfaces and
  // puddles become horizontal stripes. The noise is fine — the projection
  // direction is what needs filtering.
  vec3 N = normalize(vNormal);
  float angleMask = smoothstep(0.5, 0.9, mix(1.0, N.y, uAngleMask));
  float puddle = mask * angleMask * uWetness;

  // Base dry surface — quick procedural concrete tint so the puddle reads.
  vec3 dryAlbedo = mix(
    vec3(0.42, 0.40, 0.36),
    vec3(0.30, 0.27, 0.24),
    gradient_noise(worldUV * 6.0) * 0.6 + 0.3
  );
  dryAlbedo = mix(dryAlbedo, vec3(0.36, 0.30, 0.22), uTint);

  // ----- The three things one WetMask drives simultaneously -----
  // 1) BaseColor darkens (water absorbs)
  vec3 wetAlbedo = dryAlbedo * mix(1.0, 0.45, puddle);
  // 2) Roughness drops (smoother surface = sharper highlight)
  float rough    = mix(0.95, 0.04, puddle);
  // 3) Normal flattens (water surface kills micro-detail)
  vec3 surfaceN  = mix(N, vec3(0.0, 1.0, 0.0), puddle * 0.8);

  // Cheap PBR-ish shading.
  vec3 lightDir = normalize(vec3(0.35, 0.85, 0.4));
  vec3 viewDir  = normalize(cameraPosition - vWorldPos);
  vec3 halfDir  = normalize(lightDir + viewDir);

  float diff = max(dot(surfaceN, lightDir), 0.0);
  // Specular: sharper when wet (low rough), broader when dry.
  float specPow = mix(8.0, 256.0, 1.0 - rough);
  float spec    = pow(max(dot(surfaceN, halfDir), 0.0), specPow) * mix(0.08, 1.8, 1.0 - rough);

  vec3 sky = vec3(0.62, 0.72, 0.85);
  vec3 ground = vec3(0.18, 0.16, 0.14);
  vec3 ambient = mix(ground, sky, surfaceN.y * 0.5 + 0.5) * 0.35;

  vec3 col = wetAlbedo * (ambient + diff * vec3(1.0, 0.95, 0.85));
  col += spec * vec3(1.0, 0.97, 0.9);

  // Subtle wetness rim (Fresnel-ish) on puddle edges.
  float fres = pow(1.0 - max(dot(surfaceN, viewDir), 0.0), 4.0);
  col += fres * puddle * vec3(0.5, 0.6, 0.7) * 0.4;

  col = col / (col + vec3(1.0));
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);

  // uTilt currently unused inside the shader — used by JS to rotate mesh.
  // Suppress "unused" warning on some drivers:
  if (uTilt < -1e6) discard;
}
`;

export function makePuddleDemo(): DemoConfig {
  return {
    id: 'puddle',
    vertex: DEFAULT_PLANE_VERTEX,
    fragment,
    uniforms: [
      { name: 'uPuddleScale', label: 'scale', min: 0.5, max: 6, step: 0.1, value: 2.4 },
      { name: 'uPuddleEdge', label: 'edge', min: 0.005, max: 0.4, step: 0.005, value: 0.08 },
      { name: 'uWetness', label: 'wetness', min: 0, max: 1, step: 0.01, value: 1.0 },
      { name: 'uAngleMask', label: 'angle mask', min: 0, max: 1, step: 0.01, value: 1.0 },
      { name: 'uTilt', label: 'tilt', min: 0, max: 80, step: 1, value: 0 },
      { name: 'uTint', label: 'tint', min: 0, max: 1, step: 0.01, value: 0.3 },
    ],
    sourceLanguage: 'glsl',
    sourceLabel: 'view GLSL source',
    sourceText: fragment.trim(),
    cameraDistance: 2.8,
    cameraAngle: Math.PI / 5,
    onMount(material, mesh) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(3.2, 3.2, 1, 1);
      mesh.rotation.x = -Math.PI / 2;
      // Tilt slider drives the mesh angle so users can prove the angle-mask works.
      const u = material.uniforms.uTilt;
      const apply = () => {
        const deg = (u.value as number) || 0;
        mesh.rotation.x = -Math.PI / 2 + (deg * Math.PI) / 180;
      };
      apply();
      const id = setInterval(apply, 80);
      return () => clearInterval(id);
    },
  };
}
