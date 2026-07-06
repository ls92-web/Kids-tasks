# Companion art

One folder per companion (named after the companion), five final PNGs each:

    <name>/portrait.png     circular portrait medallion art
    <name>/level1.png       Baby form
    <name>/level20.png      Explorer form
    <name>/level50.png      Hero form
    <name>/level100.png     Legend form

512px, transparent background. Paths are built ONLY by src/lib/assets.ts
(COMPANION_DIRS maps species id -> folder). Never reference these files
directly from components.
