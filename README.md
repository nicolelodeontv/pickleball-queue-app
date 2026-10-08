# QueueZeroTwo

A free pickleball paddle-stacking queue for open play. Add players, send the next four to a court, keep score, and share a live view. It runs in the browser and installs as a PWA, with no account needed.

Live: https://queuezerotwo.vercel.app

## Features

- **Queue and teams:** paddle-stacking queue, a check-in list for players who have not arrived yet, skill levels, player reordering, and rest controls.
- **Team modes:** Balanced or Social mix Up Next teams. Optional Winners stay with a configurable consecutive-win limit, plus Equal sit-outs fairness.
- **Scoring:** play to 11, 15, or 21, with win by 1 or 2. Supports 1 to 8 courts, Undo after Finish & Log, Match Log, Leaderboard, and live standings.
- **Sessions:** name a session, keep the last 30 in Past sessions, share a results link, and share a results image.
- **Players:** all-time player profiles with per-player backup and restore.
- **Backup:** Export and Import the whole session as JSON. Imports are validated and size-limited.
- **On court:** large score controls, haptics, sound, voice announcements, wake lock during matches, and light/dark themes.
- **Live View:** a read-only page for players to follow courts, Up Next, the stack, and the leaderboard in real time.
- **Host handoff:** transfer Live View hosting to another device with a QR code.
- **Offline/PWA:** service worker caching with an update-ready prompt and installable PWA metadata.

## How it works

- `index.html` is the app. Session state lives in browser `localStorage`, so the organizer's device is the source of truth.
- `profiles.js` stores all-time player profiles separately from the current session.
- `sw.js` is the service worker. **Bump the cache name (`queuezerotwo-vN`) whenever a cached file changes**, so installed copies can detect the new version and show the update prompt.
- Styling uses Tailwind CSS v3, built from `src/input.css` into `tailwind.css`. Run `npm run build:css` after adding Tailwind classes.
- `vercel.json` supplies the Content Security Policy. New script, style, font, image, or network hosts must be added there when required.
- `manifest.webmanifest` defines the installable PWA icons. `icon-512.png` is the normal icon and `icon-maskable-512.png` is the padded maskable icon. `make_maskable_icon.py` regenerates the maskable icon from `brand/logo-mark.svg` and verifies the artwork against the circular safe zone.

## Live View and the database

Live View uses Supabase. The organizer publishes session state through the app's RPC path, and viewers receive updates through a private Realtime Broadcast channel.

- Session codes are 10 characters and expire after 7 days. The host key is stored hashed in the database and is never included in viewer state.
- Host handoff puts the replacement host key in the QR URL fragment (`#h=...`), which browsers do not send to the server. The new device rotates the key so the old one stops working.
- Anyone with a Live View link can see the session's player names and scores. Do not put private information in player names.
- The SQL files in `supabase/` are split into historical base setup and current incremental security/handoff SQL:
  - `supabase/LEGACY-DO-NOT-RUN-setup.sql` is the original base table setup. Use it only when creating a new throwaway/test database. **Never run it against the existing production database**, because it recreates public insert/update policies.
  - `supabase/host_handoff.sql` contains the host-key rotation RPC and the current private Broadcast trigger/policy setup. Apply it after the base schema exists.
  - `supabase/migrations/20261006141300_private_live_view_broadcast.sql` contains the incremental private Broadcast function/policy migration for environments using migration-based deployment.
- The repo does not contain a safe replacement for the historical base schema, so an existing production database must not be rebuilt by blindly replaying every SQL file in order.

For a separate deployment, set `SB_URL` and `SB_KEY` in `index.html` to the project's URL and browser-safe publishable key. Use a publishable/browser-safe key only.

## Development

- **Tests:** there is no `npm test` script. The real browser regression is `.github/workflows/release2-playwright.yml`. Locally, run `npm ci`, `npm run build:css`, `npx playwright install chromium`, start a static server on port 4173, then run `APP_URL=http://127.0.0.1:4173/ node tests/release2b-sessions.mjs`. CI also checks the main inline JavaScript with `node --check`.
- **Production deploys:** only `main` deploys to production. Vercel's ignored build step skips every other branch.
- **Deployment quota:** production deploys count against Vercel's daily limit, so batch unrelated changes into one real PR when practical.
- **Branch hygiene:** use short-lived branches and delete them after they are merged or intentionally closed.

## Icons and SEO

- `icon-maskable-512.png` is padded for the Android maskable safe area and uses the `maskable` purpose in `manifest.webmanifest`. The normal `icon-512.png` remains a separate `any` icon.
- `robots.txt` and `sitemap.xml` use the same host as the canonical URL in `index.html`.
- If the canonical host changes to `queuezerotwo.app`, update the canonical URL, Open Graph URL/image, `robots.txt`, and `sitemap.xml` together.
