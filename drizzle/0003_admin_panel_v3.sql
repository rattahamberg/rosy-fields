CREATE INDEX "household_created_by_user_id_idx" ON "household" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "household_name_trgm_idx" ON "household" USING gin (name gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "household_member_added_by_user_id_idx" ON "household_member" USING btree ("added_by_user_id");