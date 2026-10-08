# PickleStack

PickleStack is a single-file pickleball paddle-stacking queue with skill levels, balanced or social-mix Up Next teams, scoring, shareable live sessions, a match log and a leaderboard.

## Run

Open index.html, or deploy the repo to Vercel / GitHub Pages. The organizer's working session is stored in browser localStorage.

## Development

- Tests: run `npm ci`, `npm run build:css`, install Playwright with `npx playwright install chromium`, start a static server on port 4173, then run `APP_URL=http://127.0.0.1:4173/ node tests/release2b-sessions.mjs`. CI runs the same browser regression on Ubuntu 24.04.
- Only `main` deploys to production. Other branches are skipped by Vercel's ignored build step.
- Any change to files cached by the service worker means bumping the cache name in `sw.js` so installed copies receive the update prompt.
- Database: `supabase/host_handoff.sql` contains the current host handoff function. The legacy setup is `supabase/LEGACY-DO-NOT-RUN-setup.sql`; never run it against production because it reopens public write access.

## Live View

PickleStack includes a cloud-backed Live View for players who want to follow the session from their own phones.

1. Start a session and tap Live View in the header.
2. Let players scan the QR code, open the link, or use Share.
3. The read-only view shows active courts, Up Next, the stack and leaderboard and updates through Supabase Realtime.
4. The organizer continues to manage the session from the main device. Viewers only receive the published session state.

The public session code is the access token for the Live View, so do not put private information in player names or session data.

## Supabase setup

For a separate new or throwaway deployment, use `supabase/LEGACY-DO-NOT-RUN-setup.sql` in your Supabase SQL Editor, then set SB_URL and SB_KEY in index.html to the project's URL and browser-safe publishable key. Do not use that legacy setup script on an existing production database.

The local session remains the source of truth. Cloud data is only published when the organizer uses Live View.

### Host handoff

After the original Supabase setup is installed, apply `supabase/host_handoff.sql` to add the host-key rotation RPC used by Live View handoff. Do not re-run the legacy setup script against an existing production database; that setup script contains the original public Live View policies and can reopen them.
