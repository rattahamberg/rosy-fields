-- Hand-edited (not raw drizzle-kit output): IF NOT EXISTS / IF EXISTS guards
-- added so the migration is idempotent. Preserve the guards if you regenerate.
DROP INDEX IF EXISTS "expense_household_spent_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "expense_household_active_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "settlement_household_settled_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "settlement_household_active_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_household_active_sorted_idx" ON "expense" USING btree ("household_id","spent_at" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "expense"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_household_active_sorted_idx" ON "settlement" USING btree ("household_id","settled_at" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "settlement"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_created_by_idx" ON "settlement" USING btree ("created_by_user_id");
