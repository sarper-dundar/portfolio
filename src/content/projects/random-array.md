---
title: 'Random Array — Blender Add-on'
description: 'A Blender add-on for randomised array placement. Built to solve a roof tile problem on a client commission. Free on Gumroad.'
date: '2023-01-01'
draft: false
tags:
  - tool
  - study
status: 'released'
storeUrl: 'https://sarperdundar.gumroad.com/l/ygbmx'
sidebar:
  enable: true
  toc: false
  relatedPosts: false
---

# Random Array — Blender Add-on

**Status:** Released — Free on Gumroad  
**Tool:** Blender 2.80+  
**Gumroad:** [sarperdundar.gumroad.com/l/ygbmx](https://sarperdundar.gumroad.com/l/ygbmx)

An early tool project. I was working on a commissioned house and needed roof
tiles that looked naturally varied — slightly different spacing, angle, scale
per tile. Blender's built-in Array modifier places copies at fixed intervals
with no randomness. Getting the variation I wanted manually would have meant
adjusting every tile individually.

The solution was an add-on that does what Array does but with randomisation
built in.

![Random Array panel in Blender ](../../assets/figure/random-array-panel.png)

## How it works

The key design decision was **cumulative offset with non-cumulative rotation**.
Each copy steps away from the previous one rather than from the original —
so copies form a proper row that walks across the roof rather than all
spawning on top of each other. Rotation is applied relative to the original object's orientation each time,
not compounded from the previous copy's angle. The reason was simple: Blender's
own Array modifier doesn't compound rotations, so users coming from the built-in
tool would expect the same behaviour. Cumulative rotation would have broken that
mental model and confused anyone already familiar with how Array works.

Controls exposed in the N-panel:

- Count, seed, offset ranges (X/Y/Z), rotation ranges, scale (uniform or per-axis)
- Live updates — parameters change results immediately without re-running anything
- Apply (joins all copies into one mesh) or Cancel (removes copies, restores original)

![Roof tiles with randomised placement ](../../assets/figure/random-array-result.png)

## Context

This was my first Blender add-on and an early experiment in identifying a
production problem and building a targeted tool to solve it — the same
instinct that later drove the Searchlight System and Surface Text Placer.
The tool is simple, but the habit of reaching for a custom solution when
existing tools fall short is one that compounds.

Published free on Gumroad.
