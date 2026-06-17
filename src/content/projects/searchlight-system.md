---
title: 'Searchlight System'
description: 'A volumetric searchlight system for Unity 6 URP. Built originally for Area58, later released commercially. Procedural cone mesh, Job System raycasts, depth buffer soft intersection.'
date: '2025-06-01'
draft: false
heroImage: '../../assets/figure/searchlightheroimage.png'
tags:
  - asset
  - tool
  - hlsl
  - urp
status: 'released'
storeUrl: 'https://assetstore.unity.com/packages/vfx/searchlight-system-volumetric-beam-lights-for-urp-368196'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Searchlight System

**Status:** Released — Unity Asset Store ($34.99)  
**Engine:** Unity 6, URP  
**Origin:** Built for [Area58](/portfolio/projects/area58/), then released commercially

The Area58 developer needed god rays. God rays weren't feasible at the time,
so the goal became the next best thing — a volumetric searchlight that
correctly deforms around geometry. Most volumetric light assets on the Asset
Store pass straight through walls. This one doesn't.

<iframe width="100%" height="400" src="https://www.youtube.com/embed/vi2zu_a50c4" frameborder="0" allowfullscreen></iframe>

## What it includes

A procedural cone mesh that rebuilds every frame based on raycast results.
A custom URP unlit shader with edge softness, core highlight, distance
falloff, depth-buffer soft intersection, animated atmospheric noise, and
electrical flicker. Job System raycasts running in parallel off the main
thread. Alert mode, patrol sweep, player detection, ScriptableObject presets,
and optional VFX Graph dust particles.

## The wall clipping problem

The original approach cast rays along the cone's outer rim and deformed
those vertices based on hit distances. It worked when a wall was directly
in front of the cone but failed whenever geometry sat inside the cone body —
no rim ray touched it, so the mesh passed straight through.

<iframe width="100%" height="400" src="https://www.youtube.com/embed/ikBLJKbQ9Go" frameborder="0" allowfullscreen></iframe>

The actual cause was the intermediate ring vertices. The cone uses multiple
rings between apex and rim for smooth wall transitions. These inner rings
were hardcoded to a fixed fraction of the full range — they had no knowledge
of what the raycasts found. A rim ray hitting a wall at 2 meters with a
range of 10 meters still placed the inner ring at 7.5 meters — through the
wall. The fix was one line:

```csharp
float hitDist = isOuterRim
    ? _hitDistances[i]
    : Mathf.Min(range * ringT, _hitDistances[i]);
```

Clamping each inner ring vertex to the corresponding rim hit distance fixed
the clipping. What looked like several separate problems — wall pass-through,
triangle artifacts, cone clipping — turned out to be the same single-line
bug in `BuildMesh`.

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Inner-ring bug vs the Min() fix" style="width:100%; max-width:640px; height:auto; display:block; margin:24px auto; color:var(--paper-ink);">
  <style>
    .cone-ttl { font: 600 12px ui-monospace, monospace; fill: currentColor; }
    .cone-sub { font: 10.5px ui-monospace, monospace; fill: var(--paper-ink-faint); }
    .cone-lbl { font: 11px ui-monospace, monospace; fill: var(--paper-ink-soft); }
    .cone-ln  { stroke: currentColor; stroke-width: 1.4; fill: none; }
    .cone-thin{ stroke: currentColor; stroke-width: 1; fill: none; opacity: 0.45; }
    .cone-bad { stroke: #b85a5a; stroke-width: 1.4; fill: none; }
    .cone-fix { stroke: #4f7a52; stroke-width: 1.4; fill: none; }
    .wall     { fill: var(--paper-ink); opacity: 0.18; }
  </style>
  <!-- LEFT: before fix -->
  <text x="40" y="22" class="cone-ttl">Before: inner rings hard-coded to range × ringT</text>
  <text x="40" y="38" class="cone-sub">inner rings clip through the wall</text>
  <!-- apex -->
  <circle cx="60" cy="130" r="3" class="cone-ln" fill="currentColor"/>
  <!-- outer rim -->
  <line x1="60" y1="130" x2="260" y2="70" class="cone-ln" />
  <line x1="60" y1="130" x2="260" y2="190" class="cone-ln" />
  <!-- wall -->
  <rect x="170" y="60" width="14" height="140" class="wall" />
  <text x="158" y="220" class="cone-sub">wall</text>
  <!-- rim hits the wall, gets clamped to wall -->
  <line x1="60" y1="130" x2="170" y2="100" class="cone-ln" />
  <line x1="60" y1="130" x2="170" y2="160" class="cone-ln" />
  <!-- inner rings: hardcoded at fixed fractions of range = pass through wall -->
  <line x1="120" y1="112" x2="120" y2="148" class="cone-bad" stroke-dasharray="3 2" />
  <line x1="180" y1="94"  x2="180" y2="166" class="cone-bad" stroke-dasharray="3 2" />
  <line x1="220" y1="80"  x2="220" y2="180" class="cone-bad" stroke-dasharray="3 2" />
  <text x="194" y="55" class="cone-lbl" fill="#b85a5a">inner rings clip wall</text>
  <line x1="195" y1="58" x2="200" y2="78" stroke="#b85a5a" stroke-width="1"/>
  <!-- RIGHT: after fix -->
  <text x="360" y="22" class="cone-ttl">After: Min(range × ringT, hitDistances[i])</text>
  <text x="360" y="38" class="cone-sub">inner rings clamp to the rim hit distance</text>
  <circle cx="380" cy="130" r="3" class="cone-fix" fill="currentColor"/>
  <!-- outer rim -->
  <line x1="380" y1="130" x2="580" y2="70" class="cone-ln" />
  <line x1="380" y1="130" x2="580" y2="190" class="cone-ln" />
  <!-- wall -->
  <rect x="490" y="60" width="14" height="140" class="wall" />
  <text x="478" y="220" class="cone-sub">wall</text>
  <!-- rim hits wall -->
  <line x1="380" y1="130" x2="490" y2="100" class="cone-ln" />
  <line x1="380" y1="130" x2="490" y2="160" class="cone-ln" />
  <!-- inner rings: clamped to wall hit distance, all sit at the wall plane -->
  <line x1="440" y1="113" x2="440" y2="147" class="cone-fix" />
  <line x1="470" y1="105" x2="470" y2="155" class="cone-fix" />
  <line x1="490" y1="100" x2="490" y2="160" class="cone-fix" />
  <text x="510" y="55" class="cone-lbl" fill="#4f7a52">inner rings stop at wall</text>
  <line x1="510" y1="58" x2="500" y2="80" stroke="#4f7a52" stroke-width="1"/>
</svg>

## The UV seam

A hard vertical line ran the full length of the cone even with noise at zero.
`RecalculateNormals` doesn't average normals across UV seam vertices —
`UV.x=0` and `UV.x=1` share the same world position but are separate entries
in the vertex array, so their normals diverge and create a visible hard edge.
A `SmoothSeamNormals` method finds all co-located vertex pairs after normal
recalculation and averages them. Runs in O(n²) but with only 101 vertices at
default settings the cost is under 0.1ms.

```csharp
// SmoothSeamNormals — RecalculateNormals leaves UV.x=0 and UV.x=1 verts
// with divergent normals even though they share a world position. Find
// every co-located pair, average their normals, write the result back.
for (int i = 0; i < vertices.Length; i++) {
    Vector3 averaged = normals[i];
    int count = 1;
    for (int j = i + 1; j < vertices.Length; j++) {
        if (Vector3.SqrMagnitude(vertices[i] - vertices[j]) < 0.0001f) {
            averaged += normals[j];
            count++;
        }
    }
    if (count > 1) {
        averaged = (averaged / count).normalized;
        for (int j = i; j < vertices.Length; j++)
            if (Vector3.SqrMagnitude(vertices[i] - vertices[j]) < 0.0001f)
                normals[j] = averaged;
    }
}
```

<iframe width="100%" height="400" src="https://www.youtube.com/embed/Pjaej5-iFdo" frameborder="0" allowfullscreen></iframe>

## Performance

Shadow maps dominate at 2–4ms per light. Everything else — mesh rebuild,
Job System raycasts, shader — is rounding error by comparison.

## What I learned

Procedural mesh generation from scratch — vertices, UVs, triangle winding.
The Unity Job System for parallel raycasts: `NativeArray`, `RaycastCommand.ScheduleBatch`,
completing handles across frames. Custom URP unlit shaders with
`MaterialPropertyBlock` for per-instance overrides without breaking SRP Batcher.
How the depth buffer works and how to write a URP Renderer Feature to expose it.

<iframe width="100%" height="400" src="https://www.youtube.com/embed/G0VtZZOzl7Q" frameborder="0" allowfullscreen></iframe>

_There is one known pending fix — a VFX error when an incorrect asset is
assigned to the dust particle slot. Fix is adding `HasFloat`/`HasVector4`
checks before `SetFloat` calls in `SyncVFX`. Update not yet pushed._
