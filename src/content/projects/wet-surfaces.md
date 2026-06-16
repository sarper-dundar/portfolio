---
title: 'Low Poly Wet Surfaces'
description: 'A wetness shader system for Unity URP. Procedural puddles, rain ripples, and window rain. Built as a reusable subgraph that drops into any custom shader.'
date: '2026-04-01'
draft: false
heroImage: '../../assets/figure/raintrail.PNG'
tags:
  - asset
  - shader
  - hlsl
  - wip
status: 'wip'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Low Poly Wet Surfaces

**Status:** In Progress — trail system still being refined  
**Engine:** Unity 6, URP 17.2, Shader Graph + HLSL  
**Planned price:** $15–20

A wetness shader system built around a reusable subgraph. The core product
is a `WetnessSubgraph` — takes BaseColor, BaseNormal, and BaseSmoothness as
inputs and returns wet-adjusted versions. Anyone can drop it into their own
shader without touching the internals. `WetSurface_Lit` ships as a ready-made
URP Lit replacement that uses it.

One thing learned early: subgraph inputs don't automatically appear in the
material inspector. You need matching properties on the parent shader's
blackboard wired into the subgraph node — they don't connect themselves.

<iframe width="100%" height="400" src="https://www.youtube.com/embed/mF6WJXX8vso" frameborder="0" allowfullscreen></iframe>

## Puddle system

Procedural puddle shapes from two layered Gradient Noise nodes (large scale
and small scale) multiplied together, then Smoothstepped for organic edges.
World-space XZ projection keeps puddles fixed in space regardless of mesh UVs.

A surface angle mask limits puddles to upward-facing surfaces — Normal Vector
(World) → Split.G → Saturate → Smoothstep. Without this, the world-space XZ
projection samples a 1D slice of the noise on vertical surfaces and puddles
appear as horizontal stripes on walls. The noise was correct; the projection
direction needed filtering.

<div data-lab-demo="puddle"></div>

One `WetMask` (PuddleMask × WetnessAmount) drives three things simultaneously:
base colour lerps toward a darkened version, smoothness shifts from rough to
glossy, and normals lerp toward flat — the water surface suppresses surface
detail. Three visible changes from one value. The viewer above is the same
algorithm rebuilt in GLSL on three.js — the "tilt" slider rotates the surface
so you can see the angle mask clamp puddles to up-facing geometry.

![Wetsurface subgraph](../../assets/figure/wetsurfacesubgraph.PNG)

## Rain ripple shader

Fully procedural — no textures. Built as a Custom Function HLSL node using
Cyanilux's technique.

The algorithm divides the surface into a grid of cells. Each cell gets a
randomly placed raindrop origin with a random time offset so rings don't
pulse in sync. Each pixel checks its own cell plus the 8 surrounding cells
in a 3×3 loop so ripples overlap naturally at boundaries.

<svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Voronoi 3×3 cell ripple sampling" style="width:100%; max-width:600px; height:auto; display:block; margin:24px auto; color:var(--paper-ink);">
  <style>
    .vor-ttl { font: 600 12px ui-monospace, monospace; fill: currentColor; }
    .vor-sub { font: 10.5px ui-monospace, monospace; fill: var(--paper-ink-faint); }
    .vor-lbl { font: 11px ui-monospace, monospace; fill: var(--paper-ink-soft); }
    .vor-grid{ stroke: currentColor; stroke-width: 1; fill: none; opacity: 0.4; }
    .vor-center{ stroke: currentColor; stroke-width: 1.6; fill: var(--paper-bg-deep); opacity: 0.55; }
    .vor-drop{ fill: currentColor; }
    .vor-ring{ stroke: currentColor; stroke-width: 1; fill: none; opacity: 0.55; }
    .vor-arrow{ stroke: currentColor; stroke-width: 1.1; fill: none; }
    .vor-fil  { fill: currentColor; }
  </style>
  <text x="20" y="20" class="vor-ttl">3×3 cell grid — every pixel samples its own cell + 8 neighbours</text>
  <!-- 3x3 grid -->
  <rect x="60"  y="50" width="80" height="80" class="vor-grid"/>
  <rect x="140" y="50" width="80" height="80" class="vor-grid"/>
  <rect x="220" y="50" width="80" height="80" class="vor-grid"/>
  <rect x="60"  y="130" width="80" height="80" class="vor-grid"/>
  <rect x="140" y="130" width="80" height="80" class="vor-center"/>
  <rect x="220" y="130" width="80" height="80" class="vor-grid"/>
  <rect x="60"  y="210" width="80" height="80" class="vor-grid"/>
  <rect x="140" y="210" width="80" height="80" class="vor-grid"/>
  <rect x="220" y="210" width="80" height="80" class="vor-grid"/>
  <!-- random drop per cell + cutoff circle -->
  <!-- cell (0,0) -->
  <circle cx="95" cy="80" r="2.5" class="vor-drop"/><circle cx="95" cy="80" r="20" class="vor-ring"/>
  <circle cx="172" cy="92" r="2.5" class="vor-drop"/><circle cx="172" cy="92" r="20" class="vor-ring"/>
  <circle cx="270" cy="75" r="2.5" class="vor-drop"/><circle cx="270" cy="75" r="20" class="vor-ring"/>
  <circle cx="84" cy="160" r="2.5" class="vor-drop"/><circle cx="84" cy="160" r="20" class="vor-ring"/>
  <circle cx="180" cy="172" r="2.5" class="vor-drop"/><circle cx="180" cy="172" r="20" class="vor-ring"/>
  <circle cx="262" cy="155" r="2.5" class="vor-drop"/><circle cx="262" cy="155" r="20" class="vor-ring"/>
  <circle cx="105" cy="248" r="2.5" class="vor-drop"/><circle cx="105" cy="248" r="20" class="vor-ring"/>
  <circle cx="190" cy="232" r="2.5" class="vor-drop"/><circle cx="190" cy="232" r="20" class="vor-ring"/>
  <circle cx="270" cy="260" r="2.5" class="vor-drop"/><circle cx="270" cy="260" r="20" class="vor-ring"/>
  <!-- current pixel marker -->
  <circle cx="170" cy="160" r="3" class="vor-fil"/>
  <line x1="170" y1="160" x2="172" y2="92" class="vor-arrow" stroke-dasharray="2 2"/>
  <line x1="170" y1="160" x2="180" y2="172" class="vor-arrow" stroke-dasharray="2 2"/>
  <line x1="170" y1="160" x2="190" y2="232" class="vor-arrow" stroke-dasharray="2 2"/>
  <line x1="170" y1="160" x2="84" y2="160" class="vor-arrow" stroke-dasharray="2 2"/>
  <text x="180" y="156" class="vor-lbl">current pixel</text>
  <!-- annotations -->
  <text x="330" y="80" class="vor-lbl">• drop origin per cell</text>
  <text x="330" y="98" class="vor-sub">(random pos × random time offset)</text>
  <text x="330" y="130" class="vor-lbl">○ 0.35 cutoff radius</text>
  <text x="330" y="148" class="vor-sub">ripples past this skip — fixes</text>
  <text x="330" y="161" class="vor-sub">bleed across cell boundaries</text>
  <text x="330" y="195" class="vor-lbl">→ 9 cells sampled per pixel</text>
  <text x="330" y="213" class="vor-sub">ripples overlap naturally at seams</text>
  <text x="20" y="312" class="vor-sub">d = (1−r)² × pow(saturate(1−|r−t|), sharpness) × sin((r−t) × waveCount)</text>
</svg>

The ripple math combines four things in one expression: distance falloff,
a time-visibility mask for sharp thin rings, a sine wave for concentric
circles, and a strength multiplier. Understanding how those multiply
together to produce the visual was the main learning moment:

```hlsl
// r = distance from current pixel to this cell's drop origin
// t = looped time offset for this drop
//
// (1 − r)²                        distance falloff — drop near = strong
// pow(saturate(1 − |r − t|), s)   thin-ring mask, sharpness s
// sin((r − t) × waveCount)        concentric rings inside the ring band
d = (1.0 - r) * (1.0 - r)
  * pow(saturate(1.0 - abs(r - t)), Sharpness)
  * sin((r - t) * WaveCount);
```

<div data-lab-demo="ripples"></div>

Two problems solved during development: ripples bleeding past their cell
boundary (fixed with a distance cutoff — if the ripple has expanded too far,
skip it) and the strength parameter having no effect (the original code
normalised the normal vector at the end, making it unit-length regardless of
the strength applied to XY — fixed by applying strength before normalising).

Parameters exposed: density, strength, speed, wave count, sharpness. Wave
count and sharpness were hardcoded in the original technique; exposing them
as user controls was a deliberate addition. The GLSL port above is the same
algorithm — the matrix-mul Voronoi hash in the original produced subtle
banding, so it swaps in a dot-based hash that reads cleaner at any density.
The strength-before-normalise fix is preserved.

![Rain Trail](../../assets/figure/raintrail.PNG)

## Window rain shader

A different approach. Instead of computing drop paths in code, the drops
and trails come from a raindrop hemisphere normal map with animated UV
scrolling — the UV motion does the work that path simulation would do in
the ground shader. **Refraction** comes from sampling Scene Color with an
offset Screen Position, so the view through the glass warps where drops
sit. A `_WindowTexture` slot lets you layer dirt, grime, or stained glass
on top, blended by the texture's own alpha.

This one was harder than expected. Pure Shader Graph nodes produced
flowing water rather than individual drops. A custom HLSL trail attempt
didn't read as convincing. The texture-based Cyanilux approach was what
finally worked — not everything needs to be procedural; a well-animated
texture sometimes beats complex math. The trail behaviour still needs
another pass before the asset ships.

---

_Rain ripple technique credit: [Cyanilux](https://cyanilux.com)_
