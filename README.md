# PickleStack

Pickleball open-play manager: session setup, player check-in, auto-matched teams (Balanced or Social mix), court scoring, live view, match log and leaderboard. One file: `index.html`. Data is saved in the browser (localStorage).

## Deploy
Push to GitHub and import the repo in Vercel (or enable GitHub Pages).

## Live view (optional)
Without Supabase, the Live view button shares a snapshot link. With it, viewers see courts, up next, queue and standings update in real time.
1. Create a Supabase project and run `supabase.sql` in the SQL Editor (one table, `live_matches`).
2. In `index.html`, set `SB_URL` and `SB_KEY` (Project Settings > API: project URL and anon public key).
3. Redeploy.

The anon key is public by design. The policies let anyone with it read and write `live_matches`, so keep private data out of that table.
