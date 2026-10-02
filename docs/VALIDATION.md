# Validation log

Every result below comes from a command actually run on **2026-10-02** (macOS, Darwin) against the
final code at commit `141202f`. Nothing on this page is aspirational; if a check could not be run in
this environment, it is listed as such under "Not verified here".

## Environment

- Node `v26.0.0`, npm `11.12.1` (the project requires Node >= 22.13; Node 24 is recommended and is
  what CI uses)
- Playwright Chromium installed locally (`npx playwright install chromium`)
- No Mapbox token configured in the verification environment unless stated otherwise, so the map ran
  on its keyless/offline tiers

## Results

| Check             | Command                                                       | Result                                                                                            |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Integration tests | `npm test`                                                    | **16 passed, 0 failed** (~0.9 s)                                                                  |
| Production build  | `npm run build`                                               | **Success** (Vite 7, ~3.6 s)                                                                      |
| Lint              | `npm run lint`                                                | **0 errors, 3 warnings** — the warnings are intentional `react-hooks/exhaustive-deps` in the map  |
| Formatting        | `npm run format:check`                                        | All files match Prettier                                                                          |
| Browser e2e       | `npm run test:e2e`                                            | **4 passed in 13.9 s** (board, map fallback, golden path, privacy)                                |
| Screenshots       | `npm run screenshots`                                         | 10 captures written to `docs/screens/` (5 screens × desktop 1440 px / mobile 390 px)              |
| Old-Node guard    | `npx -y node@18.17.1 server/index.js`                         | Friendly "not supported" message, exit code 1 before any import error                             |
| Dev binding       | `npm run dev`, then `lsof -iTCP -sTCP:LISTEN`                 | API listens on `127.0.0.1:8080` only — not reachable from the LAN                                 |
| LAN binding       | `npm run dev:lan`, then `lsof` + `curl` from another origin   | API listens on `0.0.0.0:8080`; foreign Origin still rejected with 403, configured LAN origin OK   |
| Secrets scan      | `git log -p --all -S 'pk.eyJ'` and `git ls-files`             | No Mapbox token in any tracked file or in history; no `.env`, `data/`, `client/dist/` tracked     |
| Doctor            | `npm run doctor`                                              | Node OK; warns when `VITE_MAPBOX_ACCESS_TOKEN` is missing/placeholder and names the free fallback |
| Fresh-clone setup | temp-dir clone → `npm ci`, `cp .env.example .env`, `db:init`, | **All steps succeeded**: 307 packages, schema initialized, demo data seeded, **16/16 tests**,     |
|                   | `db:seed`, `npm test`, `npm run build`                        | build OK. The first run caught a real bug — tests inherited `DEV_AUTO_VERIFY=true` from the       |
|                   |                                                               | copied `.env.example`; fixed in `141202f` (tests pin it off) and re-verified green.               |

## E2E coverage in this run

1. `board loads with seeded items and shows the empty state after filtering to nothing`
2. `map never ends blank when Mapbox hosts are blocked` (Mapbox routes intercepted; a map tier
   appears within 10 s)
3. `golden path: claim, approve, message, mark returned, item leaves the board`
4. `claimant session never receives finder identity in responses or page text`

## Notes

- Before the `server/preflight.js` guard existed, an unsupported Node crashed with a raw
  `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` error; the friendly message now prints instead.
- The privacy e2e deliberately excludes static JS bundle responses from its network scan: the
  sign-in dialog intentionally prints the demo credentials for everyone. All `/api/` responses are
  scanned.
- The developer's local `.env` used during this cleanup contained a real Mapbox token that `npm run
doctor` verified as still **valid** against the Mapbox API. It is not tracked by git, but the owner
  should revoke and rotate it (see "Deployment notes" in the README) and rebuild so `client/dist`
  no longer embeds it.
- Screenshots were regenerated on 2026-10-02 via `npm run screenshots` against a throwaway server
  with a temporary seeded database.

## Not verified here

- Real email delivery: verification and password-reset mails were exercised with `DEV_AUTO_VERIFY`
  and code inspection, not against a live SMTP provider.
- Production deployment behind a reverse proxy (`TRUST_PROXY=true`) was reasoned about and unit
  covered indirectly, but not exercised against a real proxy in this environment.
