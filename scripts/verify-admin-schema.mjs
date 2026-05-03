import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });

const checks = [
  ["tables", `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`],
  ["user.role column", `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='role'`],
  ["user composite index", `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='user_created_at_id_idx'`],
  ["pg_trgm extension", `SELECT extname FROM pg_extension WHERE extname='pg_trgm'`],
  ["trigram indexes", `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('user_email_trgm_idx', 'user_name_trgm_idx', 'household_name_trgm_idx')`],
  ["session_expires_at_idx", `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='session_expires_at_idx'`],
  ["household FK indexes", `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('household_created_by_user_id_idx', 'household_member_added_by_user_id_idx')`],
  ["ledger tables", `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('expense', 'expense_split', 'settlement', 'household_audit_log') ORDER BY table_name`],
  ["ledger indexes", `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('expense_household_active_sorted_idx', 'expense_paid_by_idx', 'expense_created_by_idx', 'expense_split_user_id_idx', 'settlement_household_active_sorted_idx', 'settlement_from_user_idx', 'settlement_to_user_idx', 'settlement_created_by_idx', 'household_audit_log_household_idx', 'household_audit_log_created_at_idx') ORDER BY indexname`],
  ["ledger check constraints", `SELECT conname FROM pg_constraint WHERE conrelid::regclass::text IN ('expense', 'expense_split', 'settlement') AND contype='c' ORDER BY conname`],
  ["admin_audit_log columns", `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_audit_log' ORDER BY ordinal_position`],
  ["admin_audit_log indexes", `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='admin_audit_log'`],
  ["household_member pk", `SELECT conname FROM pg_constraint WHERE conrelid='public.household_member'::regclass AND contype='p'`],
];

for (const [label, q] of checks) {
  const r = await pool.query(q);
  console.log(`-- ${label} --`);
  console.log(JSON.stringify(r.rows, null, 2));
}

await pool.end();
