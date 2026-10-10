-- Court Rotation Generator: record the deployed pg_cron expiry cleanup.
-- The production job was first observed running at 2026-09-28 17:00 UTC.
-- 20260928170000 is a source-record version identifier chosen for this
-- migration; it is not asserted to be the job's creation timestamp.
-- pg_cron does not expose a creator timestamp, so this migration records the
-- deployed job without asserting who created it.
-- The checked-in shared-chain version also ensures the extension exists when
-- a fresh replay reaches this migration. Production already has both the
-- extension and job and this version is already recorded there.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'crg-expired-session-cleanup',
  '0 * * * *',
  'delete from public.court_rotation_sessions where expires_at <= now()'
);
