# Cover art generator

Draws the 57 Mutopia song covers (`renderer/covers/<id>.png`, 512x512) from hand-authored scene specs.
No network and no extra tooling: SVG is generated in Node and rasterised by the repo's own Electron.

    node tools/covers/build.js                           # all covers -> renderer/covers/
    node tools/covers/build.js --only debussy-clair-de-lune,chopin-raindrop --out /some/dir
    node tools/covers/build.js --sheet /tmp/contact.png --per 20   # also contact sheets (5:4 tiles with title and level badge, as the app crops them)

Files
- `lib.js`: primitives (sky bands, moon, hills, waves, notes...) and `compose()`, the house style applied to every cover: a dark top scrim (the app overlays an ivory title there) and a halftone shade rising from the bottom.
- `motifs.js`: larger reusable motifs (flame, bee, hexgrid, dancers, bell, candle, organ pipes, onion dome, horseshoe magnet...).
- `scenes-*.js`: one spec per song id: palette plus a `draw()` composing motifs. `build.js` fails if a registry id has no spec.
- `render.js` / `png.js`: Electron batch rasteriser (one window, device scale 1, exact 512x512) and a median-cut indexed-PNG writer (128 colours, about 50 KB per cover).

Art rules: flat vector, a limited palette per piece, one focal point in the middle band; keep y<110 calm (title) and the bottom-left clear (level badge). No people's likenesses, logos or lettering, except the ragtime posters.
Run with `ELECTRON_RUN_AS_NODE` unset (build.js does this itself).
