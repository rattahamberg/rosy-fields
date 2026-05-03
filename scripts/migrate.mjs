// Tracked migration runner. Applies any drizzle/<tag>.sql files listed in
// drizzle/meta/_journal.json that haven't already been recorded in the
// `__migrations` table. Each migration runs in its own transaction along
// with the bookkeeping insert, so partial application is impossible.
//
// Drift detection: SHA-256 of each migration file is stored alongside the
// tag. On every run, files whose stored hash differs from their current
// hash cause a hard error — meaning a journal entry was edited after being
// applied (a serious mistake worth halting on). File contents are
// normalized to LF before hashing so Windows (CRLF) and Linux (LF) checkouts
// produce the same hash.
//
// Modes:
//   node scripts/migrate.mjs            apply pending migrations
//   node scripts/migrate.mjs --bootstrap mark all journal entries as
//                                       applied without running them
//                                       (one-time only on a DB whose schema
//                                       was created out-of-band)
//   node scripts/migrate.mjs --rehash    update stored hashes for all
//                                       already-applied entries to the
//                                       current file content (use after a
//                                       deliberate hash-affecting change
//                                       like adding IF NOT EXISTS guards or
//                                       fixing CRLF/LF normalization)

import { createHash } from "node:crypto";
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
const rehash = process.argv.includes("--rehash");

const journal = JSON.parse(
  readFileSync("drizzle/meta/_journal.json", "utf-8"),
);
const entries = journal.entries.sort((a, b) => a.idx - b.idx);

function readSql(path) {
  // Normalize CRLF → LF so Windows checkouts and Linux CI agree on hashes.
  return readFileSync(path, "utf-8").replace(/\r\n/g, "\n");
}

function hashFile(path) {
  return createHash("sha256").update(readSql(path)).digest("hex");
}

const pool = new Pool({ connectionString: url });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      sql_hash text
    )
  `);
  // Backfill column for installations created before sql_hash was tracked.
  await pool.query(
    `ALTER TABLE "__migrations" ADD COLUMN IF NOT EXISTS sql_hash text`,
  );

  const { rows: appliedRows } = await pool.query(
    `SELECT tag, sql_hash FROM "__migrations"`,
  );
  /** @type {Map<string, string | null>} */
  const applied = new Map(appliedRows.map((r) => [r.tag, r.sql_hash]));

  // --rehash short-circuits everything else: just rewrite stored hashes for
  // already-applied entries. Useful after a deliberate file edit (CRLF fix,
  // adding IF NOT EXISTS guards, etc.) that shouldn't trigger drift halt.
  if (rehash) {
    let rehashed = 0;
    for (const entry of entries) {
      if (!applied.has(entry.tag)) continue;
      const current = hashFile(join("drizzle", `${entry.tag}.sql`));
      await pool.query(
        `UPDATE "__migrations" SET sql_hash = $1 WHERE tag = $2`,
        [current, entry.tag],
      );
      rehashed++;
    }
    console.log(`Rehashed ${rehashed} migration(s).`);
    process.exit(0);
  }

  let processed = 0;
  /** @type {{ tag: string; storedHash: string; currentHash: string }[]} */
  const driftErrors = [];

  for (const entry of entries) {
    const path = join("drizzle", `${entry.tag}.sql`);
    const currentHash = hashFile(path);
    const storedHash = applied.get(entry.tag);

    if (applied.has(entry.tag)) {
      if (storedHash === null || storedHash === undefined) {
        // First run after the sql_hash column was added — backfill silently.
        await pool.query(
          `UPDATE "__migrations" SET sql_hash = $1 WHERE tag = $2`,
          [currentHash, entry.tag],
        );
        console.log(`Backfilled hash for ${entry.tag}`);
      } else if (storedHash !== currentHash) {
        driftErrors.push({ tag: entry.tag, storedHash, currentHash });
      }
      continue;
    }

    console.log(
      `${bootstrap ? "Marking" : "Applying"} ${entry.tag} (${path})`,
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (!bootstrap) {
        const sql = readSql(path);
        const statements = sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          await client.query(stmt);
        }
      }

      await client.query(
        `INSERT INTO "__migrations" (tag, sql_hash) VALUES ($1, $2)`,
        [entry.tag, currentHash],
      );
      await client.query("COMMIT");
      console.log(`  OK`);
      processed++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  FAILED: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  if (driftErrors.length > 0) {
    console.error(
      `\nERROR: ${driftErrors.length} migration(s) drifted (file hash != stored hash):`,
    );
    for (const d of driftErrors) {
      console.error(
        `  ${d.tag}: stored=${d.storedHash.slice(0, 12)} current=${d.currentHash.slice(0, 12)}`,
      );
    }
    console.error(
      "Migration files must NEVER be edited after being applied. " +
        "If a change is needed, write a new migration. " +
        "If the change is intentional (e.g. adding IF NOT EXISTS guards), run " +
        "`npm run migrate:rehash` to update stored hashes.",
    );
    process.exit(1);
  }

  if (processed === 0) console.log("No pending migrations.");
  else console.log(`Done. Processed ${processed} migration(s).`);
} finally {
  await pool.end();
}
