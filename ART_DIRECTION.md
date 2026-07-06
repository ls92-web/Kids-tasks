# Questforge — Art Direction (Creature Style Bible)

This document is the **permanent, canonical visual style** for every creature, companion,
pet, portrait, icon, evolution frame, and animation in the project. It is derived from the
two official reference sheets (the 12 collectible figurines + the 4-form evolution chart).

**Rule for all future work:** do not copy the references pixel-for-pixel — reproduce their
*style*. Anything that renders a creature must match the proportions, lighting, materials,
palette, anatomy, silhouette, expression, and finish described below.

---

## 1. The look in one line

Premium **3D chibi collectible** creatures — the polish of a top-tier mobile game
(Brawl Stars / Rift-style companions / Pixar shorts): glossy, hand-painted, soft-lit,
bursting with personality, on a clean or dark-navy backdrop.

## 2. Proportions & anatomy

- **Big-head chibi**: head is ~45–55% of the total silhouette. Body is small and rounded.
- **Huge glossy eyes** are the emotional anchor — large irises, 1–2 bright specular
  highlights, a soft lower catch-light. Eyes convey the personality more than anything else.
- Short, stubby limbs; soft rounded paws/feet; no sharp or thin extremities on Baby form.
- Chunky, readable **silhouette** — recognizable as a black shape alone.

## 3. Lighting & materials

- **Soft key light from top-left**, gentle rim light on the opposite edge.
- Materials read as **hand-painted resin / soft toy**: subtle subsurface glow, smooth
  gradients, no flat fills, no hard cel edges.
- Gentle contact shadow grounds the creature. Elemental effects **emit their own light**.

## 4. Color & elements

Rich, saturated but not neon. Each creature has ONE **elemental affinity** whose signature
color drives its glow, particles, and evolution aura. Canonical elements & glow colors
(kept in code as `ELEMENTS` in `src/lib/game.ts`):

| Element | Color | Element | Color |
|---|---|---|---|
| Fire | `#ff7a3d` | Dark | `#b06bff` |
| Ice | `#5fd0ff` | Tech | `#4fb8ff` |
| Nature | `#7ee06a` | Thunder | `#ffe45e` |
| Arcane | `#8f7bff` | Earth | `#c9a15e` |
| Light | `#ffd76a` | Storm | `#7de0d0` |

Avoid piling many bright hues on one creature — one dominant element + neutral body + white
eye highlights. The **element glow is the only loud color**.

## 5. Personality & expression

Warm, friendly, brave, a little mischievous — **never scary, never sad**. Default
expression is confident and happy. Moods used in-app: `excited`, `happy`, `proud` (eyes
closed in a smile), `sleepy` (half-lidded + floating Zs), `cheer` (big open smile + sparkle
eyes). Even a "try again" state stays encouraging.

## 6. Evolution — the four canonical forms

Every creature evolves through **four forms gated by the hero's LEVEL** (not by quest count):

| Form | Unlocks at | Feel |
|---|---|---|
| **Baby** | Level 1 | Tiny, round, oversized head & eyes, minimal gear, faint aura. |
| **Explorer** | Level 20 | Slightly taller, first bit of gear/armor, brighter aura, a prop or weapon. |
| **Hero** | Level 50 | Confident heroic pose, full themed armor/robes, strong elemental FX. |
| **Legend** | Level 100 | Epic, radiant, large elemental effects (wings of fire, ice crystals, arcane runes), the aura is a full-body glow. |

Across forms: the creature grows larger and more detailed, the **elemental aura intensifies**
at every step, and gear accumulates (bow/circlet → cape/armor → crown/full regalia).
Keep the **face and eyes recognizable** across all four forms — it's the same soul growing up.

## 7. In-code implementation

- The single source of truth for a creature at a form is the `Pet` component
  (`src/components/Pet.tsx`). It is **asset-driven**: it first tries the premium raster art,
  and only falls back to the built-in vector creature if that art is missing.
- Roster, elements, forms, thresholds, and progress live in `src/lib/game.ts`
  (`PETS`, `ELEMENTS`, `PET_FORMS`, `petForm`, `petFormProgress`, `petElement`).
- Aura strength per form is `AURA_OPACITY = [0.14, 0.22, 0.32, 0.46]` in `Pet.tsx`.

### Adding the premium art (the path to full reference quality)

Vector fallbacks approximate the style; **true reference-grade rendering comes from raster
art** produced to this spec (a 3D render or painted illustration exported as PNG). Drop files
into `public/pets/` and they are used automatically — no code changes:

```
public/pets/<species>-<form>.png     // transparent PNG, square, ~512×512
```

`<species>` is the pet id — the official 12 are `dragon`, `fox`, `owl`, `wolf`, `tiger`,
`phoenix`, `turtle`, `forest`, `robot`, `ninja`, `samurai`, `pirate`; `<form>` is `0`=Baby,
`1`=Explorer, `2`=Hero, `3`=Legend.

Example: `public/pets/dragon-0.png` … `public/pets/dragon-3.png`.

The official art for all 12 × 4 forms already ships (sourced from the reference set,
background knocked out, trimmed, squared, downscaled to 512px transparent PNG).

**Every commissioned/generated asset must follow sections 1–6 above** so the whole roster
feels like one premium set. Transparent background, centered, consistent light direction
(top-left), consistent camera height, element glow baked in.
