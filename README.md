# K Land map bundle

The interactive map that runs on https://www.kevinsilvester.com/kland, published here so the page
can load it from jsDelivr instead of carrying it inline (the inline copy was approximately 2.1 MB of
the page's 2.35 MB of HTML, so the browser could not cache it between visits).

`kland-map.js` is a small loader. The page loads it from
`https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@v1/kland-map.js` (as it always has). The loader
reads `version.json`, then requests the map bundle at `bundle.js@<version>` and the terrain at
`k-land-terrain.svg@<version>`, pinning both to the same release.

## Releases and cache updates

jsDelivr caches a URL for a week (a year for an exact version), so a URL has to change whenever its
bytes change. The loader pins the exact version, so a release is:

1. Bump `version.json` to the new tag, e.g. `{"version":"v1.1.1"}`.
2. Commit and push to the default branch.
3. Tag that commit (`git tag v1.1.1 && git push origin v1.1.1`).

Because `bundle.js` and `k-land-terrain.svg` are requested at the new version, browsers fetch the
new files on the next page view - no hard refresh, and no change to the Squarespace page.

Content and artwork belong to Kevin Silvester. All rights reserved; this repository is a delivery
mechanism, not a grant of any licence.

## Nuttin' Burger leaderboard

The burger mini-game (a separate repo, pinned into the Squarespace page at a tag) had only a
personal best per browser. Shared scores now live in a Cloudflare Worker with a KV namespace, and
the client half ships inside this bundle because the bundle is the part that can be released through
`version.json` without touching the Squarespace page.

- `worker/` - the Worker, its wrangler config, its tests and the deploy notes.
- `leaderboard/nb-leaderboard-client.js` - the client, spliced into the bundle by
  `leaderboard/patch_bundle.py`. Edit this file, not `bundle.js`, and re-splice with the API URL
  from `leaderboard/config.json` (see `leaderboard/config.example.json`).

The client runs in the parent page rather than inside the map iframe, because the game stops key
propagation for a, d, space and friends while a shift is running and a name field inside the game
would silently drop those letters. It reads the game only through the `#nb-game` markup, so if the
game's markup changes the board button and the score hook stop appearing instead of breaking play.
