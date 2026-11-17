// Creates the Four Views tables (idempotent: safe to run again).
// Usage: node --env-file=$HOME/.config/four-views/neon.env scripts/db-migrate.ts
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Pass --env-file with the Neon env.");
  process.exit(1);
}
const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS topics (
     slug        text PRIMARY KEY,
     title       text NOT NULL,
     question    text NOT NULL,
     status      text NOT NULL CHECK (status IN ('pending', 'ready', 'error')),
     payload     jsonb,
     partial     jsonb,
     trad_ids    text[] NOT NULL DEFAULT '{}',
     engine      text,
     model       text,
     cost_usd    numeric NOT NULL DEFAULT 0,
     created_at  timestamptz NOT NULL DEFAULT now(),
     updated_at  timestamptz NOT NULL DEFAULT now(),
     error       text
   )`,
  `CREATE INDEX IF NOT EXISTS topics_status_updated_idx ON topics (status, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS topics_title_lower_idx ON topics (lower(title))`,
  `CREATE TABLE IF NOT EXISTS aliases (
     query_key   text PRIMARY KEY,
     slug        text NOT NULL,
     created_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS aliases_slug_idx ON aliases (slug)`,
  `CREATE TABLE IF NOT EXISTS spend (
     day          date PRIMARY KEY,
     usd          numeric NOT NULL DEFAULT 0,
     generations  int NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS rate (
     bucket      text PRIMARY KEY,
     count       int NOT NULL DEFAULT 0,
     expires_at  timestamptz NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS rate_expires_idx ON rate (expires_at)`,
];

for (const s of statements) {
  await sql.query(s);
}
const tables = await sql.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log("Tables:", tables.map((r) => r.table_name).join(", "));
