# Companion art

The single `Companion` component (`src/components/Companion.tsx`) renders these images and
automatically picks the correct evolution form from the hero's level. The app is image-only
— there is no vector / CSS fallback creature. See `/ART_DIRECTION.md` for the style bible.

## Naming

```
<species>-<form>.png
```

- **species** (pet id): `dragon`, `fox`, `owl`, `wolf`, `tiger`, `phoenix`,
  `turtle`, `forest`, `robot`, `ninja`, `samurai`, `pirate`
- **form**: `0` = Baby (Lv 1), `1` = Explorer (Lv 20), `2` = Hero (Lv 50), `3` = Legend (Lv 100)

The official art for all 12 companions × 4 forms already ships here (transparent PNG,
squared, 512px). To reskin or add a creature, drop a matching `<id>-<form>.png` and the
app uses it automatically.

Example set for one creature: `dragon-0.png`, `dragon-1.png`, `dragon-2.png`, `dragon-3.png`.

## Specs

- Transparent PNG, square (≈512×512), creature centered.
- Top-left key light, soft rim light, subtle contact shadow.
- Elemental glow baked in, intensifying from form 0 → 3.
- Same face/eyes across all four forms of a creature (the same soul growing up).
- Follow every rule in `/ART_DIRECTION.md`.
