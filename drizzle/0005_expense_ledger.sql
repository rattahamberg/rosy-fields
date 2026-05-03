CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"paid_by" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"spent_at" date NOT NULL,
	"split_mode" text NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount_cents" > 0),
	CONSTRAINT "expense_split_mode_valid" CHECK ("expense"."split_mode" IN ('equal', 'shares', 'exact'))
);
--> statement-breakpoint
CREATE TABLE "expense_split" (
	"expense_id" text NOT NULL,
	"user_id" text NOT NULL,
	"share_cents" bigint NOT NULL,
	CONSTRAINT "expense_split_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id"),
	CONSTRAINT "expense_split_share_nonneg" CHECK ("expense_split"."share_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "household_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"note" text,
	"settled_at" date NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "settlement_amount_positive" CHECK ("settlement"."amount_cents" > 0),
	CONSTRAINT "settlement_distinct_parties" CHECK ("settlement"."from_user_id" <> "settlement"."to_user_id")
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_audit_log" ADD CONSTRAINT "household_audit_log_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_audit_log" ADD CONSTRAINT "household_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_household_spent_at_idx" ON "expense" USING btree ("household_id","spent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_household_active_idx" ON "expense" USING btree ("household_id") WHERE "expense"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_paid_by_idx" ON "expense" USING btree ("paid_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_created_by_idx" ON "expense" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_split_user_id_idx" ON "expense_split" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_audit_log_household_idx" ON "household_audit_log" USING btree ("household_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_audit_log_actor_idx" ON "household_audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_household_settled_at_idx" ON "settlement" USING btree ("household_id","settled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_household_active_idx" ON "settlement" USING btree ("household_id") WHERE "settlement"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_from_user_idx" ON "settlement" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_to_user_idx" ON "settlement" USING btree ("to_user_id");