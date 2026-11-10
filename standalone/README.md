# K Land Cloudflare migration

Base migration: published on 10 November 2026. Cloudflare serves
https://kland-kevinsilvester.pages.dev/ and the public Squarespace entry point
https://www.kevinsilvester.com/kland now embeds that build.

## Mobile update prepared 10 November 2026

This checkout includes the following mobile update:

- Steph's profile uses the approved standalone 320 × 352 portrait instead of a
  140 × 154 idle-animation crop. The original PNG is kept unchanged in source.
- Bottom navigation and the fountain activate on touch pointer release, with
  duplicate native-click suppression, drag/pinch cancellation and keyboard
  fallback. A 10 px finger-movement allowance is shared with map gestures.
- The fountain keeps at least a 48 × 48 CSS-pixel mobile tap target, including
  when the island is fully zoomed out; its artwork and bounce are unchanged.
- The beach label scales down to 60% on mobile as the map zooms out.

The 430 px browser preview passed Characters, Steph profile, Music, fountain
confirmation, full-map zoom, and burger Start/Pause/Resume/Close checks.
Event-sequence tests cover release activation, duplicate clicks, small finger
movement, drags, pinches, cancellation, inert controls, mouse and keyboard.
Phone hardware verification remains outstanding. Cloud browser DevTools are
disabled by its administrator, so this was a mobile layout check plus automated
event tests, not real touch-device emulation.

Publish through the GitHub Actions workflow below; no Squarespace shell, form,
leaderboard or DNS changes are needed for this update.
Successful deployment exposes `data-mobile-controls="20261110-v1"` on the app's
document element. This is absent from the original deployment.

The build starts from the current live map captured on 10 November 2026. This
includes fixes newer than v1.4.18: Steph's artwork and gait, the mobile popup
header, prebuilt popup cards, mobile landmark bounce, and responsive burger
buttons. `source/map.html` is the captured source of truth, not the older bundle.

## Architecture

- Cloudflare Pages serves the compiled map and game with content-hashed assets.
- The existing Squarespace `/kland` page becomes a small iframe shell. It does
  not run the old source-rewriting patch scripts or the old burger installer.
- Squarespace form pages send `X-Frame-Options: SAMEORIGIN`. The shell therefore
  owns four form iframe portals, positioned over the Cloudflare map's popup slots.
  Form values and submissions remain on Squarespace. Messages carry only frame
  geometry, loaded/busy state, navigation and the existing local game/visit state.
- The existing Cloudflare leaderboard remains authoritative. `/api/scores` is a
  narrow same-origin proxy with a 4 KiB limit; `_routes.json` runs Worker code only
  for API paths, keeping static requests out of the Functions quota.
- A direct Cloudflare preview offers working links to Squarespace forms. The
  production form overlays require the Squarespace shell.

## Build and preview

Use Python with Pillow and Node 24 (no npm dependencies):

```sh
python standalone/scripts/build.py
npm test
sites-preview start /absolute/path/to/checkout
```

The managed preview starts `scripts.dev`. It allows reading the live board but
rejects score submissions. `/preview-phone.html` supplies a 430 px layout. Add
`?diagnostics=1` to the app to expose local-only readiness and interaction timing.
This desktop-browser simulation is not an iPhone Safari hardware benchmark.

`download-assets.py` mirrors exact public production asset URLs. The index retains
each original URL. `compress-assets.py` converts PNGs to lossless WebP, verifying
decoded RGBA equality before using a smaller file. Popup photo/product thumbnails
are generated at build time rather than on every visitor's phone.

## Deployment and rollback

### Automatic deployments

`.github/workflows/kland-pages.yml` builds and tests relevant pushes to `main`,
then deploys `standalone/dist` to the existing `kland-kevinsilvester` Pages
project. Pull requests only build and test. The workflow is also available
through Actions → Build and publish K Land → Run workflow.

Configure the repository Actions secrets `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` before the first automatic deployment. The token needs
only Cloudflare Pages Edit permission for the account that owns this project.
Keep the token in encrypted secrets, never in source. Missing secrets explicitly
skip publishing and report a warning.

Each build records its full Git commit in `/build.json`. After deployment, the
workflow verifies that production serves that revision, an app script, and the
existing leaderboard API. It never writes a test score. `_worker.js` and
`_routes.json` are included; `preview-phone.html` is excluded from production.

To roll back only a Pages release, use an earlier successful production
deployment in Cloudflare, or revert the source commit and let Actions redeploy.

### Manual migration reference

1. Upload the contents of `dist` as a Cloudflare Pages Direct Upload project.
   Exclude `preview-phone.html` from the production package. `_worker.js` is the
   Pages advanced-mode entry point; only `/api/*` invokes it.
2. Verify map, burger buttons, board reads, media and mobile layout on deployment.
3. `APP_ORIGIN` in `source/squarespace-shell.js` is the verified deployment origin.
   Rebuild and use `squarespace-code-block.html` for the Squarespace K Land code
   block. The shell moves its frame directly into `body` so Fluid Engine layout
   wrappers cannot intercept map input. It uses a distinct frame ID so old
   global srcdoc patch observers do not attach to it.
4. Remove the K Land page's old header patch chain after backing it up; keep its
   fullscreen styles or the styles included in the new code block. Do not change
   unrelated site-wide header/footer code.
5. `squarespace-embed-bridge.js` is already installed site-wide, gated to four
   known paths with `?kland-embed=1`. It styles only those embedded forms.
6. Test the same-origin forms in the Squarespace shell after updates. The
   published airport fields, museum upload control, newsletter fields and Town
   Hall messages have been checked. No test submissions or scores were posted.
7. Restore the backed-up K Land header and code block to roll back. The old
   leaderboard and the user's stored scores are not deleted or migrated to a new
   database. The new shell copies known local game/visit keys to the app once.

## Measurements so far

- Captured map source HTML: 2,124,533 bytes, including embedded images.
- The separate delivery HTML is approximately 117 KiB; artwork and script files
  are independently cached. This is an HTML payload reduction, not a guarantee of
  the same percentage reduction in total page load time.
- Exact mirrored asset library: 162,732,190 bytes before lossless compression;
  105,119,589 bytes after it. 109 PNGs passed byte-for-byte decoded pixel checks.
- Initial mobile-layout trial: 15.10 s readiness and 937 ms total blocking time.
  After prebuilt popup thumbnails and script preloads: 9.65 s and 537 ms.
  Cache conditions differ; this is an indicative local result, not a controlled
  before/after comparison with production.
- Mobile Places/airport interactions in that trial had worst observed event
  duration 56 ms. Actual iPhone testing remains outstanding.

## Published verification

- The live page contains one Cloudflare app iframe and no legacy map iframe.
- All four form portals load before they are opened and hide when closed.
- Existing leaderboard scores and all 34 logged shifts remain available.
- Burger Start, Pause, Resume and Close work in the 430 px Squarespace preview.
- The mobile Psychic Readings header has the small close cross and no extra star.
- Museum and newsletter embeds omit the surrounding Squarespace header/footer;
  form placeholders have explicit contrast on the dark popup background.
- Source scripts compile, all delivered asset references exist, and six proxy
  routing/validation checks pass. Actual iPhone Safari hardware testing remains
  outstanding; the desktop mobile layout check is not a hardware benchmark.

No paid plan or DNS change was introduced. The updated Cloudflare ZIP includes
the mobile update above; the published shell and form-style adjustments live
on Squarespace. Rollback copies of the original code block, page header and
global header are included in the private source archive.

Known migration detail: landmark hashes inside the Cloudflare frame do not yet
mirror each navigation back to the outer Squarespace address bar. Existing
incoming `#place=` links are passed into the app at startup.
