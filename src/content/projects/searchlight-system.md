---
title: 'Searchlight System'
description: 'A volumetric searchlight system for Unity 6 URP. Built originally for Area58, later released commercially. Procedural cone mesh, Job System raycasts, depth buffer soft intersection.'
date: '2025-06-01'
draft: false
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
**Origin:** Built for [Area58](/projects/area58), then released commercially

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

## The UV seam

A hard vertical line ran the full length of the cone even with noise at zero.
`RecalculateNormals` doesn't average normals across UV seam vertices —
`UV.x=0` and `UV.x=1` share the same world position but are separate entries
in the vertex array, so their normals diverge and create a visible hard edge.
A `SmoothSeamNormals` method finds all co-located vertex pairs after normal
recalculation and averages them. Runs in O(n²) but with only 101 vertices at
default settings the cost is under 0.1ms.

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
