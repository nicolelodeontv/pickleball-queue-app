# PickleStack

Pickleball paddle-stacking queue with scoring, shareable live matches, a match log and a leaderboard. One file: `index.html`.

## Run
Open `index.html`, or deploy the repo to Vercel / GitHub Pages. Everything is saved in the browser (localStorage).

## Live sharing (optional)
Without this, the share button sends a snapshot link. With it, viewers see scores update in real time.
1. Create a Supabase project and run `supabase.sql` in the SQL Editor.
2. In `index.html`, set `SB_URL` and `SB_KEY` (Project Settings > API: project URL and the anon public key).
3. Redeploy. Share buttons now produce short live links.

The anon key is meant to be public. The policies in `supabase.sql` let anyone with it read and write `live_matches`, which is fine for a scoreboard but not for private data.
