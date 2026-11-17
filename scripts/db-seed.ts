// Upserts every checked seed topic (data/topics/*.json) into the database as ready.
// Usage: node --env-file=$HOME/.config/four-views/neon.env scripts/db-seed.ts
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { TopicSchema } from "../lib/schema.ts";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Pass --env-file with the Neon env.");
  process.exit(1);
}
const sql = neon(url);
const dir = path.join(process.cwd(), "data", "topics");
// zz-*.json files are UI fixtures, never seeded into the live database.
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("zz-"))
  : [];

let ok = 0;
let bad = 0;
for (const file of files) {
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch {
    bad++;
    console.error(`skip ${file}: not valid JSON`);
    continue;
  }
  const parsed = TopicSchema.safeParse(json);
  if (!parsed.success) {
    bad++;
    console.error(`skip ${file}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    continue;
  }
  const t = parsed.data;
  await sql`
    INSERT INTO topics (slug, title, question, status, payload, partial, trad_ids, engine, model, cost_usd, error, created_at, updated_at)
    VALUES (${t.slug}, ${t.title}, ${t.question}, 'ready', ${JSON.stringify(t)}::jsonb, NULL,
            ${t.traditionIds}::text[], ${t.meta.engine}, ${t.meta.model ?? null}, ${t.meta.costUsd ?? 0}, NULL,
            ${t.meta.generatedAt}::timestamptz, now())
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, question = EXCLUDED.question, status = 'ready',
      payload = EXCLUDED.payload, partial = NULL, trad_ids = EXCLUDED.trad_ids,
      engine = EXCLUDED.engine, model = EXCLUDED.model, cost_usd = EXCLUDED.cost_usd,
      error = NULL, updated_at = now()`;
  ok++;
}
console.log(`Seeded ${ok} topic(s)${bad ? `, skipped ${bad} invalid` : ""} from ${files.length} file(s).`);
