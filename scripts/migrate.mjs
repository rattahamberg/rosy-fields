// Tracked migration runner. Applies any drizzle/<tag>.sql files listed in
// drizzle/meta/_journal.json that haven't already been recorded in the
// `__migrations` table. Each migration runs in its own transaction along
// with the bookkeeping insert, so partial application is impossible.
//
// Usage:
//   node --env-file=.env.local scripts/migrate.mjs            # apply pending
//   node --env-file=.env.local scripts/migrate.mjs --bootstrap # mark all
//                                                                journal
//                                                                entries as
//                                                                applied
//                                                                without
//                                                                running them
//
// Bootstrap is for the one-time case where migrations were previously
// applied out-of-band (drizzle-kit push, hand-rolled SQL). After bootstrap,
// only future migrations actually execute.
//
// In CI, env vars come from GitHub secrets — no --env-file needed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

const bootstrap = process.argv.includes("--bootstrap");

const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf-8"),
);
const entries = journal.entries.sort((a, b) => a.idx - b.idx);

const pool = new Pool({ connectionString: url });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows: appliedRows } = await pool.query(
    `SELECT tag FROM "__migrations"`,
  );
  const applied = new Set(appliedRows.map((r) => r.tag));

  const pending = entries.filter((e) => !applied.has(e.tag));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    await pool.end();
    process.exit(0);
  }

  for (const entry of pending) {
    const path = join("drizzle", `${entry.tag}.sql`);
    console.log(
      `${bootstrap ? "Marking" : "Applying"} ${entry.tag} (${path})`,
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (!bootstrap) {
        const sql = readFileSync(path, "utf-8");
        const statements = sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          await client.query(stmt);
        }
      }

      await client.query(`INSERT INTO "__migrations" (tag) VALUES ($1)`, [
        entry.tag,
      ]);
      await client.query("COMMIT");
      console.log(`  OK`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  FAILED: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`Done. Processed ${pending.length} migration(s).`);
} finally {
  await pool.end();
}
