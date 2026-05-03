import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  process.exit(1);
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql>");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const sql = readFileSync(sqlPath, "utf-8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statements from ${sqlPath}`);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const stmt of statements) {
    console.log(`  ${stmt.split("\n")[0].slice(0, 80)}...`);
    await client.query(stmt);
  }
  await client.query("COMMIT");
  console.log("Done.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
