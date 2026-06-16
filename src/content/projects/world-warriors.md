---
title: 'World Warriors — Fire Awareness Commission'
description: 'A commissioned project for a government office on fire awareness, reached through personal contacts. Cancelled before shipping, but the small scope meant I could build a wide range of high-detail materials without worrying about performance.'
date: '2025-02-01'
draft: false
heroImage: '../../assets/figure/realisticdamagedwall.PNG'
tags:
  - commission
  - substance-designer
  - materials
  - unity
status: 'cancelled'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# World Warriors

**Status:** Cancelled (early 2025)
**Client:** Government office — fire-awareness campaign
**Tools:** Substance Designer → exported PBR textures → Unity 6 URP
**My role:** Material authoring in Substance Designer

A commissioned project for a government office working on a public fire-awareness piece. The team reached me through personal contacts. The project was eventually cancelled, but the scope was narrow enough — a handful of scenes, no streaming, no large open environments — that performance was effectively a non-concern. That gave me room to push every material as far as it could go.

All of these are Substance Designer materials. Each one was authored as a node graph in Substance Designer, then exported as a PBR texture set (BaseColor, Normal, Roughness, AO, Height) and brought into Unity URP. The workflow was repetitive in a good way: find a credible Substance tutorial for the look I needed, follow it through, then strip it down and rebuild the graph until it stopped looking like the tutorial.

## Damaged wall

The main hero material — broken plaster over a cement substrate, dirt and edge wear, varied normal detail.

<div data-material-viewer data-slug="damaged-wall" data-name="Damaged wall — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao,height" data-mesh="sphere" data-tiles="2"></div>

![Realistic damaged wall result](../../assets/figure/realisticdamagedwall.PNG)

![Damaged wall — Substance Designer graph](../../assets/figure/realisticdamagedwallnode.PNG)

![Damaged wall in 3D scene](../../assets/figure/realisticdamagedwall3d.PNG)

### Modular inner-layer variant

The interesting variant. The cement is the outer layer; what's visible inside the broken-out areas is normally baked into the graph. I exposed those end nodes as Substance Designer graph inputs instead — the inside material becomes a parameter rather than a wired-in texture. Drop in brick, a different brick pattern, wood planks, or rebar and the same wall reads as a completely different construction without rebuilding the graph. One Substance graph, many wall variants exported as separate texture sets depending on what got slotted in.

![Damaged wall — Substance Designer graph with exposed inner material input](../../assets/figure/realisticdamagedwallnodechange.PNG)

## Cement

The substrate material used underneath the damaged wall, also usable on its own for floors and bases.

<div data-material-viewer data-slug="cement" data-name="Cement — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao" data-mesh="sphere" data-tiles="2.5"></div>

![Realistic cement result](../../assets/figure/realisticcement.PNG)

![Cement — Substance Designer graph](../../assets/figure/realisticcementnode.PNG)

## Ground

A general dirt/ground material for outdoor surfaces.

<div data-material-viewer data-slug="ground" data-name="Ground — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao,height" data-mesh="plane" data-tiles="2"></div>

![Realistic ground result](../../assets/figure/realisticground.PNG)

![Ground — Substance Designer graph](../../assets/figure/realisticgroundnode.PNG)

## Grass ground

Layered grass on top of the ground base — height-blended, with separate normal and roughness handling for the grass strands.

<div data-material-viewer data-slug="grassyground" data-name="Grass ground — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao,height" data-mesh="plane" data-tiles="2"></div>

![Realistic grass ground result](../../assets/figure/realisticgrassground.PNG)

![Grass ground — Substance Designer graph](../../assets/figure/realisticgrassgroundnodes.PNG)

## Asphalt

Road and paved-surface material.

<div data-material-viewer data-slug="asphalt" data-name="Asphalt — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao,height" data-mesh="plane" data-tiles="2"></div>

![Asphalt result](../../assets/figure/asphalt.PNG)

![Asphalt — Substance Designer graph](../../assets/figure/asphaltnode.PNG)

## Rusted panel

Metal panel with rust, edge wear, and weathering for industrial set dressing.

<div data-material-viewer data-slug="rusted-panel" data-name="Rusted panel — Substance Designer" data-maps="basecolor,normal,roughness,metallic,ao,height" data-mesh="sphere" data-tiles="2"></div>

![Rusted panel result](../../assets/figure/rustedpanel.PNG)

![Rusted panel — Substance Designer graph](../../assets/figure/rustedpanelnode.PNG)

## Takeaway

The cancellation was disappointing but the work paid off as a portfolio of finished, high-detail Substance Designer materials across very different surface types — plaster, cement, dirt, grass, asphalt, weathered metal. Working at high quality without a performance ceiling was a useful exercise in itself; it made the constraints on later projects easier to reason about, because I had a concrete sense of what "expensive but pretty" actually looks like coming out of Substance — and how much of that detail survives the texture export into Unity.
