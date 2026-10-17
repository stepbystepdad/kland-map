# Nuttin' Burger leaderboard Worker

Shared top scores for the Nuttin' Burger mini-game on https://www.kevinsilvester.com/kland .

The game itself lives in `stepbystepdad/kland-nuttin-burger` and is pinned into the Squarespace page
at a tag, so putting the board there would mean an Editor change on every deploy. The client half of
the board therefore ships inside the map bundle (`../leaderboard/`), which is already loaded through
`version.json`, and this Worker holds the scores.

## Deploy (once)

```sh
cd worker
npx wrangler login                                  # opens a browser, or set CLOUDFLARE_API_TOKEN
npx wrangler kv namespace create NB_SCORES          # prints an id
# paste that id into wrangler.toml, replacing PASTE_THE_KV_NAMESPACE_ID_HERE
npx wrangler deploy                                 # prints the workers.dev URL
```

The URL it prints (`https://kland-nuttin-leaderboard.<your-subdomain>.workers.dev`) is what belongs
in `../leaderboard/config.json` as `api`, after which the bundle is re-spliced:

```sh
cd ..
python3 leaderboard/patch_bundle.py --config leaderboard/config.json --out bundle.js
```

Then release as usual: tag the commit, then bump `version.json` to that tag.

With an API token instead of a browser, the token needs **Workers Scripts: Edit** and
**Workers KV Storage: Edit** for the account, plus **Account Settings: Read** so wrangler can find
the account id. Pass it as `CLOUDFLARE_API_TOKEN` and add `CLOUDFLARE_ACCOUNT_ID`.

## Tests

```sh
cd worker
node test_nb-worker.mjs
```

Runs the Worker against a stub KV and covers the endpoint contract, ordering, ranking, the per-run
dedupe, the hourly cap, name and score validation and the CORS origin rule.

## What it does

- `GET /scores` -> `{ top: [...], total: n }`, best first.
- `POST /scores` -> `{ ok: true, rank, total, top }` for a sane score, otherwise `400`, `409`
  (that run is already on the board) or `429` (more than 30 shifts from one browser in an hour).
- `/` answers `{"ok":true,"board":"nuttin-burger"}` as a deploy health check.

Rows are stored at `s:<999999-score>:<time>:<run id>` so KV's own key order is best-score-first and
the top of the board is a single `list()`. The name, score and order count ride in the key's
metadata, so reading the board costs no per-row gets. Range checks, the dedupe and the hourly cap
all happen here, which is why there is no key in the page to abuse: the client only knows this URL.

## Moderation

The board is anonymous, so expect junk eventually. Names are rendered with `textContent` and are
stripped of control characters and capped at 24, but nothing stops someone posting a rude one.
To remove a row, list the keys and delete the one whose metadata names it:

```sh
npx wrangler kv key list --binding NB_SCORES --prefix s: > /tmp/board.json
npx wrangler kv key delete --binding NB_SCORES "s:000123456:1792235283473:the-run-id"
```

To hide everything one browser posted, its `visitor` id is in the rate-limit key
(`rl:<visitor>:<hour>`); `npx wrangler kv key list --binding NB_SCORES --prefix rl:` shows them.
