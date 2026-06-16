---
title: 'Surface Text Placer'
description: 'A Unity editor tool for placing TextMeshPro text on flat surfaces directly from the Scene view. Click any surface, text appears oriented to the normal and parented to the object.'
date: '2026-04-01'
draft: false
heroImage: '../../assets/figure/writing_tool.PNG'
tags:
  - asset
  - tool
  - editor
status: 'submitted'
sidebar:
  enable: true
  toc: true
  relatedPosts: false
---

# Surface Text Placer

**Status:** Submitted — Unity Asset Store ($4.99)
**Engine:** Unity 6, URP
**Category:** Tools > Level Design

A Unity editor tool: activate it, click any surface, type, and an
inscription appears at that point — oriented to the surface normal,
parented to the object so it moves with it. The competitor on the store
charges $39 for a decal-only, runtime-focused version. This one uses
real TMP 3D geometry and is built around the editor click-to-place
workflow that nothing else handles well.

<iframe width="100%" height="400" src="https://www.youtube.com/embed/TnYMkSeLcdQ" frameborder="0" allowfullscreen></iframe>

## The extrusion detour

The original plan included extruded 3D text — letters with depth. Front
and back faces worked; the sides came out as rectangular blocks. The
reason is how TMP works: TMP uses Signed Distance Field rendering, so
the actual mesh is one quad per character regardless of the letter
shape. Extruding that gives boxes. Real letter-shaped extrusion would
mean reading bezier curves from the font file and tessellating them —
weeks of work for a $5 tool. I dropped extrusion and focused entirely
on the placement workflow.

![Surface Text Placer — tool window](../../assets/figure/writing_tool.PNG)

## The four problems that actually mattered

**Alignment buttons fighting each other.** Initial implementation used
Toggle nodes, which evaluate every frame — whichever Toggle ran last
won. Switched to Buttons, which only fire on click.

**Deprecated API.** `enableWordWrapping` is removed in Unity 6.
Replaced with `textWrappingMode = TextWrappingModes.NoWrap`.

**Inspector updates not refreshing in Scene view.** `ForceMeshUpdate()`
alone wasn't enough — `EditorUtility.SetDirty()` on the TMP component
was also required to force an immediate repaint.

![Inscription Placer in use](../../assets/figure/inscriptionplacer.PNG)

**Rotation save bug.** The Reset button restored the wrong rotation
when users had rotated with the gizmo rather than the Inspector slider
— the two had drifted apart. Fix: read the actual transform rotation
in `SaveCurrentPosition` and compute the angle relative to a base
rotation derived from the stored surface normal, so rotation applied
by any method gets captured.

```csharp
// SaveCurrentPosition — derive the rotation around the surface normal
// from whatever the user actually did, gizmo OR slider.
Quaternion baseRotation = Quaternion.LookRotation(forward, up);
Quaternion currentRotation = data.transform.rotation;
Quaternion rotationDiff = Quaternion.Inverse(baseRotation) * currentRotation;
float angle = rotationDiff.eulerAngles.z;          // forward axis = normal
if (angle > 180f) angle -= 360f;
data.savedRotation = angle;
```

**Local-space storage** is the other invisible decision. Position and
normal are stored in the parent's local space, not world space — world
coordinates go stale the moment the parent moves. Converting back at
reset time means the inscription always returns to its correct spot on
the surface regardless of how the parent has been transformed.

<svg viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="World-space vs local-space storage when the parent moves" style="width:100%; max-width:640px; height:auto; display:block; margin:24px auto; color:var(--paper-ink);">
  <style>
    .ws-ttl { font: 600 12px ui-monospace, monospace; fill: currentColor; }
    .ws-sub { font: 10.5px ui-monospace, monospace; fill: var(--paper-ink-faint); }
    .ws-lbl { font: 11px ui-monospace, monospace; fill: var(--paper-ink-soft); }
    .ws-ln  { stroke: currentColor; stroke-width: 1.4; fill: none; }
    .ws-thin{ stroke: currentColor; stroke-width: 1; fill: none; opacity: 0.5; }
    .ws-dim { stroke: var(--paper-ink-faint); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
    .ws-bad { stroke: #b85a5a; stroke-width: 1.4; fill: none; }
    .ws-fix { fill: #4f7a52; }
  </style>
  <text x="20" y="22" class="ws-ttl">World-space coords go stale when the parent moves</text>
  <text x="20" y="38" class="ws-sub">Inscription stored as (x, y, z) in world space — wrong spot after parent translates</text>
  <!-- frame 1: parent at A -->
  <text x="30" y="60" class="ws-lbl">Parent at A</text>
  <rect x="30" y="70" width="120" height="120" class="ws-ln"/>
  <circle cx="120" cy="100" r="4" fill="currentColor"/>
  <text x="128" y="100" class="ws-lbl">inscription</text>
  <text x="30" y="208" class="ws-sub">world: (120, 100)</text>
  <text x="30" y="222" class="ws-sub">local: (90, 30)</text>
  <!-- arrow -->
  <line x1="170" y1="130" x2="210" y2="130" class="ws-thin"/>
  <polygon points="206,126 214,130 206,134" fill="currentColor"/>
  <text x="172" y="120" class="ws-sub">parent moves +60 →</text>
  <!-- frame 2 -->
  <text x="240" y="60" class="ws-lbl">Parent at B (world coords stored)</text>
  <rect x="240" y="70" width="120" height="120" class="ws-ln"/>
  <!-- where the original world coord points now -->
  <circle cx="330" cy="100" r="4" class="ws-bad"/>
  <line x1="320" y1="90" x2="340" y2="110" class="ws-bad"/>
  <line x1="340" y1="90" x2="320" y2="110" class="ws-bad"/>
  <text x="348" y="100" class="ws-lbl" fill="#b85a5a">wrong spot</text>
  <text x="240" y="208" class="ws-sub" fill="#b85a5a">world: (120, 100) — points off-surface</text>
  <!-- frame 3 -->
  <text x="430" y="60" class="ws-lbl">Parent at B (local coords stored)</text>
  <rect x="430" y="70" width="120" height="120" class="ws-ln"/>
  <circle cx="520" cy="100" r="4" class="ws-fix"/>
  <text x="528" y="100" class="ws-lbl" fill="#4f7a52">still on surface</text>
  <text x="430" y="208" class="ws-sub" fill="#4f7a52">local: (90, 30) → TransformPoint at B</text>
  <text x="20" y="262" class="ws-sub">SaveCurrentPosition stores parent.InverseTransformPoint(world);  ApplyTransform rebuilds world via parent.TransformPoint(local).</text>
</svg>

## What I learned

Unity editor scripting from the ground up: `EditorWindow`,
`CustomEditor`, `SceneView.duringSceneGui`, `HandleUtility`, the `Undo`
system, `Physics.Raycast` in an editor context rather than gameplay,
`Quaternion.LookRotation` for surface orientation, and `EditorPrefs`
for cross-session persistence. The Reset button alone is what made the
world-space-vs-local-space distinction click for me concretely.
