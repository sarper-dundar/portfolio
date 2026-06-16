---
title: 'Tengri — Magic VFX (Unreal + Substance Designer)'
description: "A stylised magic VFX built in Unreal Engine from Substance Designer textures. Learning project from Bruno Afonseca's ArtStation course, re-authored to my own visual direction."
date: '2023-06-01'
draft: false
heroImage: '../../assets/figure/unrealvfx/sarper-dundar-tengre.jpg'
tags:
  - vfx
  - substance-designer
  - unreal
  - study
status: 'finished'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Tengri — Magic VFX

**Year:** 2023
**Engine:** Unreal Engine (Cascade)
**Textures:** Substance Designer
**Course:** _[Creating Real-Time VFX in Unreal Using Substance Designer](https://www.artstation.com/learning/series/wv/creating-real-time-vfx-in-unreal-using-substance-designer)_ — Bruno Afonseca, ArtStation Learning

A learning project, not released anywhere. I worked through Bruno
Afonseca's four-part course but re-authored the whole piece — own
textures, own art direction. I called it _Tengri_, after the Turkic
sky-god, and pushed the look toward cool light and vertical motion
rather than the course's reference.

<video controls muted loop playsinline preload="metadata" poster="../../assets/figure/unrealvfx/sarper-dundar-tengre.jpg" style="width:100%; border-radius:10px; display:block;">
  <source data-base-src="/videos/tengri-vfx.mp4" type="video/mp4">
  Sorry, your browser does not support embedded video.
</video>

## What it taught me

Parts 1 and 2 — the Substance Designer half — were the real takeaway.
Bruno's approach reframed SD for me as a _VFX texture_ tool, not just a
PBR-tileable tool: the same shape and noise nodes I'd been using for
walls suddenly read as brushes for animated masks and channel-packed
particle data. That shift carried into the World Warriors materials and
the [dwarf base material](/projects/grand-strategy-map) — both pure SD
output applied in Unity URP.

Parts 3 and 4 — Cascade — translated unexpectedly well to Unity's VFX
Graph later. Once you've understood one particle system properly, the
other feels like rotation rather than relearning. The transferable part
is _what a real-time particle system needs from a texture_ — and that's
exactly what the SD half teaches.
