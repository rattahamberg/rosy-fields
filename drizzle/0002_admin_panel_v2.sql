-- Idempotent: pg_trgm extension and the two trigram indexes were already
-- created out-of-band by an earlier ad-hoc migration. The IF NOT EXISTS
-- guards make this safe to re-apply on environments that already have them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD COLUMN IF NOT EXISTS "actor_email" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_created_at_id_idx" ON "user" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "user" USING gin (email gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_name_trgm_idx" ON "user" USING gin (name gin_trgm_ops);
