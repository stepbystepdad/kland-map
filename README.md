# K Land map bundle

The interactive map that runs on https://www.kevinsilvester.com/kland, published here so the page
can load it from jsDelivr instead of carrying it inline (the inline copy was approximately 2.1 MB of
the page's 2.35 MB of HTML, so the browser could not cache it between visits).

kland-map.js is a verbatim extract of the script that was inline in the page's map code block. It is
loaded with defer, so the page's own markup is parsed first and behaviour is unchanged.

Content and artwork belong to Kevin Silvester. All rights reserved; this repository is a delivery
mechanism, not a grant of any licence.

## Releases and cache updates

The K Land page loads this bundle through a small loader that pins an exact
release, so visitors never need a hard refresh. jsDelivr caches URLs for a week
(or a year for exact versions), so the URL must change whenever the bytes change.

To publish an update:

1. Bump `version.json` to the new tag, e.g. `{"version":"v1.0.5"}`.
2. Commit and push to the default branch.
3. Tag that commit (`git tag v1.0.5 && git push origin v1.0.5`).

The loader reads `version.json` from the default branch, then requests
`kland-map.js@<version>` and `k-land-terrain.svg@<version>`. Because both URLs
carry the new version, browsers fetch the new files on the next page view.
