# PickleStack

PickleStack is a single-file pickleball paddle-stacking queue with skill levels, balanced or social-mix Up Next teams, scoring, shareable live sessions, a match log and a leaderboard.

## Run

Open index.html, or deploy the repo to Vercel / GitHub Pages. The organizer's working session is stored in browser localStorage.

## Live View

PickleStack includes a cloud-backed Live View for players who want to follow the session from their own phones.

1. Start a session and tap Live View in the header.
2. Let players scan the QR code, open the link, or use Share.
3. The read-only view shows active courts, Up Next, the stack and leaderboard and updates through Supabase Realtime.
4. The organizer continues to manage the session from the main device. Viewers only receive the published session state.

The public session code is the access token for the Live View, so do not put private information in player names or session data.

## Supabase setup

For a separate deployment, run supabase.sql in your Supabase SQL Editor, then set SB_URL and SB_KEY in index.html to the project's URL and browser-safe publishable key.

The local session remains the source of truth. Cloud data is only published when the organizer uses Live View.

### Host handoff

After the original Supabase setup is installed, apply `supabase/host_handoff.sql` to add the host-key rotation RPC used by Live View handoff. Do not re-run `supabase.sql` against an existing production database; that setup script contains the original public Live View policies and can reopen them.
