// Topic store. v0: reads the checked, seeded topics bundled in data/topics/*.json.
// The data layer (lib/db.ts) extends this with the Neon cache; pages only ever
// call getTopic / listTopics, so they never need to know where a topic lives.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { TopicSchema, type Topic, type TopicSummary } from "./schema";

const SEED_DIR = path.join(process.cwd(), "data", "topics");

async function readSeed(slug: string): Promise<Topic | null> {
  try {
    const raw = await fs.readFile(path.join(SEED_DIR, `${slug}.json`), "utf8");
    return TopicSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getSeedTopic(slug: string): Promise<Topic | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return readSeed(slug);
}

export async function listSeedTopics(): Promise<TopicSummary[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(SEED_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const topics = await Promise.all(files.map((f) => readSeed(f.replace(/\.json$/, ""))));
  return topics
    .filter((t): t is Topic => t !== null)
    .map((t) => ({
      slug: t.slug,
      title: t.title,
      question: t.question,
      traditionIds: t.traditionIds,
      generatedAt: t.meta.generatedAt,
    }));
}

// Public API used by pages. The data layer may replace these bodies to
// consult the database first and fall back to the seeds.
export async function getTopic(slug: string): Promise<Topic | null> {
  return getSeedTopic(slug);
}

export async function listTopics(): Promise<TopicSummary[]> {
  return listSeedTopics();
}
