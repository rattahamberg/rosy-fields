-- Optional retention/cleanup jobs for Neon Postgres.
--
-- Prerequisites:
--   1. Enable the pg_cron extension in your Neon project (Settings → Extensions
--      → enable `pg_cron`). It is NOT in Neon's default extension allowlist
--      and must be turned on per-database via the Neon console.
--   2. Connect with a role that owns the target tables.
--   3. Run this file once: `psql $DATABASE_URL_UNPOOLED -f scripts/setup-cron.sql`
--
-- The two jobs:
--   * Purges `session` rows that expired more than 24h ago — keeps the table
--     small so the admin user-list LEFT JOIN on active sessions stays fast.
--   * Purges `admin_audit_log` rows older than 90 days — bounded growth.
--     Adjust the interval if you need a longer compliance retention.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily at 03:00 UTC: drop expired sessions older than a day of grace.
SELECT cron.schedule(
  'purge-expired-sessions',
  '0 3 * * *',
  $$DELETE FROM "session" WHERE expires_at < now() - interval '1 day'$$
);

-- Weekly on Sunday at 03:30 UTC: drop audit log entries older than 90 days.
SELECT cron.schedule(
  'purge-old-audit-log',
  '30 3 * * 0',
  $$DELETE FROM admin_audit_log WHERE created_at < now() - interval '90 days'$$
);

-- To inspect:    SELECT * FROM cron.job;
-- To unschedule: SELECT cron.unschedule('purge-expired-sessions');
