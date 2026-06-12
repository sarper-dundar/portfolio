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

## Faction material — Dwarves (first completed)

The first finished material for the project. Each playable race needs a
visual identity that reads at map scale, and the dwarves were the first I
took through to completion.

**Setting context.** The dwarves are an iron-working race living on
iron-rich land. Their walls and infrastructure are affected by a
mushroom-like disease that gathers across surfaces, sends out red mycelial
connections, and slowly destroys the land it spreads across. So the
material has to read as two things at once — industrial iron-working
craftsmanship and an organic biological infection growing through it.

**Direction from the writer (translated):**

> Architecture: Art Nouveau in the Antoni Gaudí tradition, Soviet
> Constructivism, and — for the Barzar walls — iron walls woven into vine
> shapes alongside dead reefs.
>
> Biological: H. R. Giger's drawings can be drawn on as reference.

The writer asked for a Giger-leaning treatment so the affected surfaces
would feel alien. My take was to keep the silhouette and motifs
recognisably dwarven rather than literally biomechanical — Giger's
language of ribbed organic forms and dark bone-like structures, but
running through molten iron and mycelium instead of bone and chitin. The
result is a base ground material built on those two ingredients: iron
that reads as poured and partially cooled, and mycelial growth threading
through it.

![Dwarf base material — node graph](../../assets/figure/gigerbonenode.PNG)

![Dwarf base material — surface result](../../assets/figure/gigerbone2.PNG)

![Dwarf base material — variation](../../assets/figure/gigerbone3.PNG)

This is the material that goes underneath everything else in dwarven
territory. The corruption-spreading system will eventually drive its
parameters at the province level — provinces deeper into the infection
get higher mycelium coverage and more visible red connections.

## Why this project still matters for portfolio

Using WMSK2 rather than building borders from scratch was the right engineering
call — it would have taken months to reach parity with a mature $105 asset, and
the result still wouldn't have the edge cases handled. The interesting tech art
work in a real studio context is almost always extending and customising existing
systems, not rebuilding infrastructure. That's what this role is.

The portfolio piece is the visual differentiation work — the systems that couldn't
be bought off the shelf.

---
