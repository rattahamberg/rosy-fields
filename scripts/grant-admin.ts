import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import { user } from "../lib/db/schema";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const email = args.find((a) => !a.startsWith("--"));

  if (!email) {
    console.error("Usage: npm run grant-admin -- <email> [--dry-run]");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
    process.exit(1);
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema: { user } });

  try {
    if (dryRun) {
      const [match] = await db
        .select({
          id: user.id,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      if (!match) {
        console.log(`[dry-run] No user with email ${email} — would not promote.`);
        process.exit(1);
      }
      if (match.role === "admin") {
        console.log(`[dry-run] ${email} is already admin (id=${match.id}).`);
      } else {
        console.log(
          `[dry-run] Would promote ${email} (id=${match.id}) from "${match.role}" to "admin".`,
        );
      }
    } else {
      const result = await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.email, email))
        .returning({ id: user.id, email: user.email, role: user.role });

      if (result.length === 0) {
        console.error(
          `No user with email ${email}. Sign up at /signup first, then re-run.`,
        );
        process.exit(1);
      }

      console.log(`Granted admin: ${JSON.stringify(result[0])}`);
    }
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
