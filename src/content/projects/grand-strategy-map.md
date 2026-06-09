---
title: 'Grand Strategy Map — Visual Systems (Collab)'
description: 'Tech art contribution to a collaborative fantasy grand strategy game. Building custom visual effects, fantasy differentiators, and atmospheric systems on top of World Map Strategy Kit 2.'
date: '2026-05-01'
draft: false
tags:
  - game
  - shader
  - vfx
  - wip
status: 'wip'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Grand Strategy Map — Visual Systems

**Status:** In Progress — long-term passion project  
**Engine:** Unity 6, URP 17.2  
**Role:** Tech Artist — visual effects and atmosphere  
**Map framework:** World Map Strategy Kit 2 (Kronnect)

A collaborative fantasy grand strategy game (EU4 / CK3 inspired). The team
is using World Map Strategy Kit 2 as the map rendering foundation — it handles
province borders, political layers, pathfinding, and fog of war. My work sits
on top of that: the visual systems that make it look like a fantasy game rather
than a reskin of a historical one.

## What I own

### Fantasy visual differentiators

The one system that makes this distinct from a historical grand strategy game.
Still being defined with the team, but the leading candidate is a dynamic
corruption / ley line spreading system — regions visibly corrupt over time via
shader-driven mask propagation, crystal formations grow, color desaturates.
Direct application of the GPU Growth System techniques.

### Custom shaders extending WMSK2

WMSK2 provides the map pipeline; custom URP shaders go on top for art direction.
Water treatment, shore atmosphere, terrain mood — the difference between a map
that looks functional and one that looks like it belongs to this specific world.

### VFX Graph — map decoration and atmosphere

Animated city smoke, wind-blown banners, magical effect layers (ley line glow,
corruption particles). The same VFX Graph skills from the Asset Store work
apply directly here.

### Atmosphere and lighting integration

Cloud shadow pass across terrain, time-of-day mood shifts, volumetric atmosphere
for dramatic zoomed-out views. Planned integration point for the Volumetric
Lighting asset once it's built.

## Why this project still matters for portfolio

Using WMSK2 rather than building borders from scratch was the right engineering
call — it would have taken months to reach parity with a mature $105 asset, and
the result still wouldn't have the edge cases handled. The interesting tech art
work in a real studio context is almost always extending and customising existing
systems, not rebuilding infrastructure. That's what this role is.

The portfolio piece is the visual differentiation work — the systems that couldn't
be bought off the shelf.

---
