import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import { user } from "../lib/db/schema";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run grant-admin -- <email>");
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
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
