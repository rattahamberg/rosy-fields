-- Hand-edited (not raw drizzle-kit output): IF EXISTS / IF NOT EXISTS guards
-- added so the migration is idempotent. Preserve the guards if you regenerate.
ALTER TABLE "expense_split" DROP CONSTRAINT IF EXISTS "expense_split_share_nonneg";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_audit_log_created_at_idx" ON "household_audit_log" USING btree ("created_at");--> statement-breakpoint
-- Tighten share_cents > 0 to match the application's rejection of 0-share
-- participants. No-op for existing rows because the app already enforced this;
-- defense-in-depth against direct SQL inserts.
ALTER TABLE "expense_split" DROP CONSTRAINT IF EXISTS "expense_split_share_positive";--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_share_positive" CHECK ("share_cents" > 0);
