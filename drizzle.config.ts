import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// drizzle-kit uses node-postgres (TCP), not the Neon WebSocket pool.
// Always migrate against the *unpooled* URL — PgBouncer (the pooled host)
// blocks DDL locks, prepared statements, and SET commands that migrations
// frequently need.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
