-- Hand-edited (not raw drizzle-kit output): IF NOT EXISTS added so the
-- migration is idempotent. drizzle-kit generate emits unconditional
-- CREATE INDEX; preserve the guard if you regenerate this file.
CREATE INDEX IF NOT EXISTS "session_expires_at_idx" ON "session" USING btree ("expires_at");
