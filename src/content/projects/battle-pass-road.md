---
title: 'Battle Pass Road — Mobile Progression UI & State FX'
description: 'A scrollable mobile battle-pass screen built in Unity URP. Reward nodes with full locked / claimable / claimed / premium states, animated claim and level-up flows, and a hand-written HLSL outline-glow shader. Data-driven, no backend, animated entirely with coroutines instead of a tween library.'
date: '2026-07-20'
draft: false
heroImage: '../../assets/figure/UIScreenShot.PNG'
tags:
  - ui
  - mobile
  - hlsl
  - urp
status: 'finished'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Battle Pass Road — Mobile Progression UI & State FX

**Engine:** Unity 6, URP
**Status:** Finished — self-directed study

A self-directed study in mobile progression UI: a horizontally scrollable
battle-pass road where every reward reads its state at a glance, claiming
feels rewarding without getting noisy, and the whole thing runs on
placeholder data with no backend behind it. The goal was to hit the polish
bar of a shipped mobile game's season screen — state FX, animated economy,
and a custom shader — while keeping the frame budget honest.

<video controls muted loop playsinline preload="metadata" poster="../../assets/figure/UIScreenShot.PNG" style="width:100%; border-radius:10px; display:block;">
  <source data-base-src="/videos/battle-pass-road.mp4" type="video/mp4">
  Sorry, your browser does not support embedded video.
</video>

## What it includes

- **Scrollable road** — horizontal layout of level columns, each with a free and a premium reward node, connected by a fillable progress bar.
- **Five reward states** — locked, unlocked, claimable, claimed, and premium, each with its own visual treatment (tint, glow, badge, checkmark, lock).
- **Animated claim flow** — tapping a claimable reward opens a popup; currency icons then fly to the header counters, which roll up to the new total.
- **Level-up economy** — buy the next level with diamonds; XP flies to the bar, the bar fills, the road segment advances, and the buy-endpoint respawns at the new fill position with an increased cost.
- **Insufficient-funds shop** — not enough diamonds routes to a store popup with buy buttons that fly diamonds back into the header.
- **Ultimate reward** — a special reward pinned to the end of the road, greyed until max level.
- **Edge indicators** — screen-anchored previews for the next level and the end reward, so off-screen progress is never invisible.
- **Custom HLSL outline-glow shader** for the "this one is ready" emphasis.

## The state machine behind every node

Every node computes its state from one integer — the player's current level
— compared against the level it sits on. Below current is `Unlocked`, equal
is `Claimable`, above is `Locked`, and `Claimed` is sticky once set.
Premium is a separate flag layered on top: always shown locked,
non-interactable, no glow or badge.

The trap was recomputing states on every level-up and wiping the sticky
`Claimed` flag in the process. The fix was to guard the recompute so a
claimed reward never gets downgraded back to unlocked:

```csharp
if (level.freeReward.state != RewardState.Claimed)
    level.freeReward.state = ComputeState(level.level);
```

One line, but without it every purchased level silently un-claimed
everything the player had already collected.

## The outline-glow shader

The claimable rewards needed to glow _along the shape of the icon_ —
emission bleeding out from the silhouette, not a soft blob pasted behind
it. That's the one place a shader earned its keep, so I hand-wrote it in
HLSL rather than reaching for Shader Graph.

The shader samples the sprite's alpha in a radial pattern around each
pixel — 4 rings × 12 taps, staggered by phase and weighted by distance so
the falloff is smooth and never bands. Where there's alpha _nearby_ but
the current pixel is transparent, that's the glow zone; it gets tinted
and faded outward. The original sprite composites on top untouched, and
the whole thing stays compatible with Unity UI's stencil and clip-rect
masking.

```hlsl
for (int r = 0; r < RINGS; r++)
{
    float ringDist   = (float)(r + 1) / RINGS;
    float ringWeight = 1.0 - ringDist * 0.5;
    float angleOffset = (float)r * 0.26;   // stagger to hide banding
    for (int t = 0; t < TAPS; t++)
    {
        float angle = (float)t / TAPS * 6.28318 + angleOffset;
        float2 uv = spriteUV + float2(cos(angle), sin(angle)) * glowOffset * ringDist;
        glowAlpha += SampleAlpha(uv) * ringWeight;
    }
}
```

The subtle gotcha: a UI glow needs room to render _outside_ the sprite,
but a UI Image is clipped to its RectTransform. I solved it by insetting
the sprite inward with a `_SpritePadding` parameter — the sprite draws in
the center, the freed border becomes glow space. That only works if the
sprite's mesh type is **Full Rect**; on the default **Tight** setting
Unity trims the quad to the visible pixels and the padding remap
collapses. Half an hour of "why is my icon flying off the bottom of the
screen" traced back to that one import setting.

## The fill head that survives a respawn

The buy-level button sits at the end of the filled portion of the
progress bar, and it's destroyed and respawned every time the player
levels up. But the reference had a second element — a little decorative
"head" riding the tip of the fill — that stayed put _through_ the
level-up animation, sliding along as the bar advanced while the button
briefly vanished.

So the fill head couldn't be part of the button. I made it an independent
element that reads the fill's live end-point every frame in `LateUpdate`
and converts it from the scrolling content's local space, out to world
space, and into its own parent's space:

```csharp
Vector3 world = _contentParent.TransformPoint(new Vector3(_fillEndPoint.x, _fillEndPoint.y, 0));
Vector3 local = fillHead.parent.InverseTransformPoint(world);
fillHead.anchoredPosition = (Vector2)local + fillHeadOffset;
```

Because it lives _outside_ the scroll view's mask, it isn't clipped at
the road's edges — but the world-space conversion still makes it scroll
and animate in perfect lock with the fill inside the mask. Same trick as
the edge previews: track a masked element from an unmasked parent.

## Chaining animations without a tween library

No DOTween, no dependencies — every animation is a coroutine, and every
sequence is stitched together with `Action onComplete` callbacks. That
kept the ordering explicit and, more importantly, kept the _economy_
honest: currency is only added to the player's balance **after** the fly
animation lands, never on the tap.

The level-up is the longest chain — spend diamonds → fly XP to the bar →
fill the bar → advance the current road segment → advance the next
segment halfway → respawn the buy-endpoint — and it reads top-to-bottom
as nested callbacks rather than a tangle of timers. Notification badges
and shine sweeps each start on a random phase offset so a screen full of
them never pulses in sync.

## Performance

The deliberate call was **UI Images driven by script instead of Particle
Systems** for all the UI FX. Particle Systems fight the Canvas for sort
order and render in world space; for 2D UI juice, animated Images are
cheaper, sort predictably, and keep overdraw legible. Frames and panels
are 9-sliced so a handful of small textures stay crisp at any size. The
glow shader's 48-tap loop runs _only_ on the few emphasized nodes —
everything else uses the default UI shader — and the fly effects cap at
8 short-lived icons at a time. Nothing here rebuilds the layout during a
scroll.

## What I learned

Most of the difficulty in "juicy" UI isn't any single effect — it's
_sequencing_. The moment two animations can overlap, or a value can
change before its animation finishes, the screen starts lying to the
player about their own balance. Forcing every flow through explicit
completion callbacks made the whole thing predictable, and the one
shader I did write taught me more about UI masking and sprite import
quirks than the shading math itself did.
