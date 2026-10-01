# Reunite · VIT Campus Lost & Found

A complete local full-stack campus recovery application: React, Vite, Mapbox GL JS, Motion, Lucide, Express and persistent SQLite. No separate database server is needed. The refreshed interface uses soft liquid-glass surfaces, responsive layouts, animated transitions and reduced-motion support.

## Quick start (macOS, Windows or Linux)

Install **Node.js 24 LTS** (minimum 22.13). Extract this ZIP, open a terminal inside `vit-reunite`, and run:

```bash
npm ci
cp .env.example .env
npm run db:init
npm run db:seed
npm run dev
```

Windows PowerShell: replace `cp .env.example .env` with `Copy-Item .env.example .env`.

Open **http://localhost:5173**. Backend: **http://localhost:8080**. Keep the terminal open. `Ctrl+C` stops both processes. The supplied public Mapbox token is configured in `.env.example`, so the map works after the copy step above.

The interactive map plots both lost and found reports. In a report, select a campus landmark, then tap the map or drag the pin to the item's last-seen / recovery position. The crosshair can use the device's current location. On the board map, the crosshair can keep the device location updated while it is switched on. Permission is requested by the browser only after the student taps the control. The tracker stays in the browser; only a pin deliberately attached to a report is saved and shown to other students. Opening a report shows its landmark and saved coordinates, with a button to center the main map on that spot. The public `pk.` token is intended for browser maps; restrict its allowed URLs in the Mapbox account before deploying the site.

Students may optionally attach one item photo to a report and one private proof photo to a claim. JPEG, PNG, and WebP files are accepted up to 5 MB; the server re-encodes images as WebP, resizes them to 1600 px, and removes embedded metadata. Report photos are public with the listing. Claim proof is visible only to the reporter and claimant. Photos are saved under `data/uploads`; back up this folder together with the SQLite database.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Reporter / finder | finder@vitstudent.ac.in | CampusDemo2026! |
| Claimant | student@vitstudent.ac.in | CampusDemo2026! |

These are preverified **local demo accounts**, not real student identities. Seeding is idempotent and disabled in production. The board contains six clearly illustrative sample reports. Skip `db:seed` for a clean database. SQLite is created at `data/reunite.sqlite` and persists across restarts.

### Test the complete workflow

1. Sign in as the student. Open a found item, answer its question, and submit a private verification request.
2. Sign out and sign in as the finder. Open **My activity**, review the answer, and approve or reject it.
3. After approval, open **Private handoff**, send a message and propose a campus checkpoint and time.
4. Sign back in as the student to reply. Threads refresh every five seconds.
5. Either approved party can select **Mark returned**. The listing disappears from active boards and the conversation becomes read-only.

Lost reports also accept private recovery requests. For these, the reporter sets a question that the person who recovered the item can answer. The approval and handoff flow is the same.

## Student signup and email verification

Signup accepts `@vitstudent.ac.in` or `@vit.ac.in` addresses and VIT-format registration numbers, hashes passwords with bcrypt, and requires email verification before login. This verifies control of a VIT mailbox, not official university SSO enrollment. Local development prints the one-use, 24-hour verification URL in the backend terminal; open it and then sign in. SMTP-configured environments send that link by email. The API never returns verification tokens. No phone number is collected.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env` to deliver real verification email. Production startup requires SMTP. Never commit `.env` or demo databases.

## Production build and local execution

```bash
npm run build
# Set APP_ORIGIN=http://localhost:8080 in .env for this single-server mode.
npm start
```

Open http://localhost:8080. Express serves the built frontend and API from one origin. Development accepts localhost, 127.0.0.1, and IPv6 loopback origins on any port. Production requires an exact APP_ORIGIN match. Vite uses port 5173 and reports an error if it is occupied instead of silently switching ports.

For an internet deployment, use Node 24, `NODE_ENV=production`, an HTTPS `APP_ORIGIN`, working SMTP, a TLS reverse proxy, and a persistent writable volume for `DATABASE_PATH`. Secure session cookies require HTTPS. This SQLite edition is intended for a single backend process; use a shared database and shared rate-limit store before running multiple replicas. Back up the database using SQLite's backup facilities while running, or copy the database only after stopping the application. No cloud deployment is included.

## Requirements implemented

- Separate lost/found feeds, text search, category/venue filters and pagination.
- Interactive campus map with all matching item pins, a nearby-items rail, and Mapbox live geolocation controls.
- New reports include an exact map pin for where an item was last seen or found; the official campus landmark stays as a readable label.
- Reporters can upload a public item photo; claimants can attach private photo proof. Uploads are size/type checked, re-encoded as WebP, resized and stripped of image metadata. Private proof photos are served only after verifying the reporter or claimant's session.
- Existing SQLite databases gain nullable latitude / longitude columns automatically. Older reports without pins remain visible in list view.
- Existing SQLite databases gain nullable item-photo and claim-proof references automatically. Uploaded image files are stored separately in `data/uploads` and must be backed up with the database.
- The location picker stores only the chosen item location. Live student location is permission-gated, browser-only and never sent to the server.
- Exactly 42 permitted landmarks: SJT, TT, PRP, SMV, MB, GDN, CDMM; MH-A–MH-T; LH-A–LH-J; Gazebo, Food Mall, DC; Central Library; Sports Complex.
- Exactly six categories: ID Cards, Room Keys, Calculators, Lab Equipment, Earphones, Wallets.
- Public item responses use an explicit allowlist, with no reporter ID, name, email, registration or phone.
- Public descriptions reject common registration, email and phone formats; students should use nonidentifying descriptions. This is pattern-based filtering, not a guarantee against deliberate obfuscation. Challenges are public questions; verification answers stay private.
- Private claimant responses visible only to that claimant and the reporter, with approve/reject controls restricted to the reporter.
- Only one approved request per item, enforced by a database index and transaction. Approval rejects other pending requests and reserves the listing for handoff.
- Anonymous in-app conversations restricted to the approved parties. Sender IDs and identities are never returned. No mobile contact details are required; common contact formats are blocked in chat.
- Safe checkpoint proposals and local-time scheduling with shared IST display. Both parties confirm proposals in the thread.
- Either reporter or approved claimant can resolve a listing; pending requests close, active feeds exclude it and messages become read-only.
- Zod validation, parameterized SQL, server authorization, HttpOnly/SameSite session cookies, hashed session/verification tokens, seven-day sessions, Origin enforcement, Helmet, request size limits and rate limiting.
- Loading skeletons, empty states, success feedback, validation errors, disabled busy buttons, focus-contained dialogs, keyboard navigation, responsive layout and reduced motion.

## Structure

```text
vit-reunite/
  client/
    src/main.jsx       React screens, forms, board and dialogs
    src/MapboxMap.jsx  Mapbox view, item pins and location picker
    src/styles.css    Liquid-glass visual system and animation
    vite.config.js     Development API proxy
  server/
    app.js             Express endpoints, auth and ownership checks
    db.js              Database schema and transactional operations
    constants.js       Strict campus venue/category/checkpoint lists
    index.js           Server entry point
  scripts/
    bootstrap.js       Database initialization
    seed.js            Repeatable demo bootstrap
  tests/
    workflow.test.js   Recovery lifecycle and security integration tests
  .github/workflows/ci.yml
  .env.example
  package.json
  package-lock.json
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/meta, /api/stats, /api/health | Metadata, board counts, health |
| POST | /api/auth/register, /verify, /login, /logout | Student account lifecycle |
| GET | /api/auth/me | Current private account |
| GET/POST | /api/items | Filtered public board / authenticated report |
| GET | /api/map/items | All matching public items with saved map pins (up to 500) |
| GET | /api/items/:id | Anonymous public listing |
| GET | /api/items/:id/photo | Public image attached to a report |
| POST | /api/items/:id/claims | Private verification request |
| GET | /api/claims/:id/proof-photo | Private proof image, reporter and claimant only |
| GET | /api/dashboard | Current student's reports and private requests |
| PATCH | /api/claims/:id | Reporter-only approve/reject |
| GET | /api/claims/:id/thread | Approved parties' anonymous conversation |
| POST | /api/claims/:id/messages | Approved party message |
| PATCH | /api/claims/:id/meetup | Checkpoint/time proposal |
| POST | /api/items/:id/resolve | Authorized lifecycle completion |

Every mutating API request must send an allowed `Origin`: an exact `APP_ORIGIN` match, or a loopback origin in development. The browser does this automatically. Authenticated endpoints use the session cookie.

## Validation

```bash
npm test
npm run build
```

Integration tests use an isolated in-memory database and verify approvals, rejections, duplicate requests, self-claims, outsider access denial, private-data projections, lost reports, messages, checkpoint scheduling, lifecycle closure, invalid venues, public PII rejection, authentication and CSRF-origin rejection. GitHub Actions runs these checks automatically.

## Publish a public GitHub repository

The ZIP is repository-ready. Create an **empty public** repository called `vit-reunite` in your GitHub account, then:

```bash
git init
git add .
git commit -m "Build VIT Reunite full-stack recovery portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vit-reunite.git
git push -u origin main
```

Or, with authenticated GitHub CLI:

```bash
git init
git add .
git commit -m "Build VIT Reunite full-stack recovery portal"
gh repo create vit-reunite --public --source=. --remote=origin --push
```

A public repository has not been created by this ZIP. Replace `YOUR_USERNAME` with your account. The ignore rules exclude dependencies, build output, credentials and the database.

## Troubleshooting

- `node:sqlite` unavailable: install Node 24 LTS and check `node --version`.
- Connection error: run `npm run dev` from the root folder and check both terminal processes.
- Origin rejected: match `.env` `APP_ORIGIN` to the exact URL and restart the backend.
- Cannot sign in: use the seeded demo credentials or verify your signup link.
- Port in use: stop the other process or change `PORT` and the Vite proxy together.
- Map does not load: check `VITE_MAPBOX_ACCESS_TOKEN` in `.env`, restart `npm run dev`, and confirm the public token is enabled.
- Location button is disabled: allow location access in the browser. Geolocation requires HTTPS outside `localhost`.
- Fonts unavailable offline: the UI falls back to system sans-serif; item illustrations and icons are bundled code.

This is a student project, not an official VIT service. Campus checkpoint labels are coordination choices; students should confirm desk availability.

## Design

Editable Figma concept screens: https://www.figma.com/design/ZjBQx6vbcqNquyDq5PLhTx

The Figma file contains a campus board, private verification view, and approval/handoff view. The runnable React UI adds responsive behavior and animation.

## License

MIT. See LICENSE.
