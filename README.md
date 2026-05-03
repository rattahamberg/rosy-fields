# rosy-fields

Personal Next.js 16 app: email/password auth, a dashboard, and an admin panel
for searching users and curating households.

## Features

- Email/password auth (Better Auth)
- Admin panel: user search, household CRUD with audit log
- Household expense ledger: per-household shared expenses with equal/shares/exact splits, settlements, balance computation, and "simplify debts" suggestions

## Stack

- **Next.js 16** (App Router; `proxy.ts` is the middleware file, NOT `middleware.ts`)
- **React 19** with Server Components + Server Actions (`useActionState` for forms with field state)
- **Better Auth 1.x** (`lib/auth.ts`) — email/password only
- **Drizzle ORM** + **Neon Postgres** over WebSocket (`@neondatabase/serverless`); money stored as `bigint` cents
- **Tailwind v4**, deployed on **Vercel**

## First-time setup

```bash
npm install
cp .env.example .env.local       # then fill in DATABASE_URL_*, BETTER_AUTH_*
npm run migrate                  # apply pending Drizzle migrations
npm run dev                      # http://localhost:3000
```

Sign up at `/signup`, then promote the first admin from another shell:

```bash
npm run grant-admin -- you@example.com
# preview without writing:
npm run grant-admin -- you@example.com --dry-run
```

## Scripts

| Command                         | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                   | Dev server with Turbopack                                               |
| `npm run build`                 | Production build                                                        |
| `npm run lint`                  | ESLint                                                                  |
| `npm run migrate`               | Apply pending migrations against `DATABASE_URL_UNPOOLED`                |
| `npm run migrate:bootstrap`     | Mark all migrations as applied without running them (one-time only)     |
| `npm run migrate:rehash`        | Rewrite stored sql_hash values after a deliberate file edit             |
| `npm run grant-admin -- <email>`| Promote a user to `role = 'admin'`                                      |

## Environment

See `.env.example`. All vars are required at runtime.

| Var                       | What                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`            | Neon **pooled** connection (PgBouncer) — used at runtime   |
| `DATABASE_URL_UNPOOLED`   | Neon **unpooled** connection — used by migrations          |
| `BETTER_AUTH_SECRET`      | 32-byte base64. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `BETTER_AUTH_URL`         | Public origin, no trailing slash                           |

## Migrations

Schema lives in `lib/db/schema.ts`. After editing:

```bash
npx drizzle-kit generate --name <description>   # writes drizzle/000X_<description>.sql
# inspect/edit the SQL, then:
npm run migrate                                 # apply locally
git add drizzle/ lib/db/schema.ts               # commit BOTH the schema and the journal
git push                                        # CI runs the same `npm run migrate` against prod
```

The `__migrations` table tracks applied tags AND the SHA-256 of each file.
Editing an already-applied migration causes `npm run migrate` to error out.
Always write a new migration instead.

`scripts/setup-cron.sql` is an optional one-time setup for pg_cron retention
jobs (purges expired sessions and old audit log rows). Requires the pg_cron
extension to be enabled in the Neon console.

## CI / Deploy

`.github/workflows/migrate.yml` runs on push to `master`:
1. Applies any pending migrations to prod (via `DATABASE_URL_UNPOOLED` secret).
2. Optionally triggers a Vercel deploy hook (set `VERCEL_DEPLOY_HOOK` secret
   AND disable Vercel's git auto-deploy if you want strict ordering).

Vercel auto-deploys on push to `master` by default — that runs in parallel
with the migration job, so a migration failure can briefly leave new code on
old schema. Use the deploy hook setup to gate Vercel behind the migration.

## Architecture notes

- Admin auth gate lives in `lib/admin/dal.ts`. **Every** admin page must call
  `await verifyAdmin()` at the top — the layout call alone is insufficient
  under partial rendering (Next 16 docs explicitly warn about this).
- Admin mutations are Server Actions in `app/admin/households/actions.ts`.
  Each one wraps the DB write AND the audit log insert in a single
  `db.transaction()` so they cannot diverge.
- View pages use `after()` (`next/server`) for non-blocking audit writes.
- Shared admin components live in `app/admin/_components/` (underscore
  prefix = private, never routable).
- Per-page constants live in `lib/admin/config.ts`. Don't sprinkle magic
  numbers across page files.
