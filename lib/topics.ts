// Topic store. Pages only ever call getTopic / listTopics / getTopicStatus, so
// they never need to know where a topic lives:
//   1. the database (Neon), ready topics only, cached by Next for an hour;
//   2. the checked seed files bundled in data/topics/*.json.
// Without a database, the in-memory store in lib/db.ts stands in for (1).
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { TopicSchema, type Topic, type TopicSummary } from "./schema";
import type { GetTopicResponse } from "./api-contract";
import { getReadyPayload, getTopicRow, hasDatabase, isStalePending, listReadySummaries } from "./db";

const SEED_DIR = path.join(process.cwd(), "data", "topics");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TOPICS_TAG = "topics";

// ---------------------------------------------------------------------------
// Seeds

async function readSeed(slug: string): Promise<Topic | null> {
  try {
    const raw = await fs.readFile(path.join(SEED_DIR, `${slug}.json`), "utf8");
    return TopicSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getSeedTopic(slug: string): Promise<Topic | null> {
  if (!SLUG_RE.test(slug)) return null;
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
    .map(summarize);
}

function summarize(t: Topic): TopicSummary {
  return {
    slug: t.slug,
    title: t.title,
    question: t.question,
    traditionIds: t.traditionIds,
    generatedAt: t.meta.generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Database reads (cached)

class NotReady extends Error {}

/** Ready topic from the database, or null. Misses are never cached (a pending topic becomes ready later). */
async function getDbTopic(slug: string): Promise<Topic | null> {
  const load = async () => {
    const payload = await getReadyPayload(slug);
    const parsed = payload ? TopicSchema.safeParse(payload) : null;
    if (!parsed?.success) throw new NotReady();
    return parsed.data;
  };
  try {
    if (!hasDatabase()) return await load(); // memory store: nothing to cache
    return await unstable_cache(load, ["fv-topic", slug], {
      revalidate: 3600,
      tags: [TOPICS_TAG, `topic:${slug}`],
    })();
  } catch (e) {
    if (!(e instanceof NotReady)) console.error("[topics] database read failed:", e);
    return null;
  }
}

const listDbSummaries = unstable_cache(() => listReadySummaries(), ["fv-topic-list"], {
  revalidate: 300,
  tags: [TOPICS_TAG],
});

async function getDbSummaries(): Promise<TopicSummary[]> {
  try {
    return hasDatabase() ? await listDbSummaries() : await listReadySummaries();
  } catch (e) {
    console.error("[topics] database list failed:", e);
    return [];
  }
}

/** Call after a topic becomes ready so lists and pages pick it up. Safe to call anywhere. */
export function invalidateTopics(slug?: string): void {
  try {
    revalidateTag(TOPICS_TAG, "max");
    if (slug) revalidateTag(`topic:${slug}`, "max");
  } catch {
    // Outside a request scope: the time-based revalidate (5 min list, 1 h topic) still applies.
  }
}

// ---------------------------------------------------------------------------
// Public API used by pages, OG images, the sitemap and the API.

/** A ready topic: database first, else the seed file. Deduped per request. */
export const getTopic = cache(async (slug: string): Promise<Topic | null> => {
  if (!SLUG_RE.test(slug)) return null;
  return (await getDbTopic(slug)) ?? (await getSeedTopic(slug));
});

/** Every ready topic (database ∪ seeds, deduped by slug), newest first. */
export const listTopics = cache(async (): Promise<TopicSummary[]> => {
  const [db, seeds] = await Promise.all([getDbSummaries(), listSeedTopics()]);
  const bySlug = new Map<string, TopicSummary>();
  for (const s of seeds) bySlug.set(s.slug, s);
  for (const s of db) bySlug.set(s.slug, s); // the database copy wins
  return [...bySlug.values()].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : a.generatedAt > b.generatedAt ? -1 : 0));
});

/** Live status for the API and for polling pages. Never cached. */
export async function getTopicStatus(slug: string): Promise<GetTopicResponse> {
  if (!SLUG_RE.test(slug)) return { status: "missing" };
  let row = null;
  try {
    row = await getTopicRow(slug);
  } catch (e) {
    console.error("[topics] status read failed:", e);
  }
  if (row?.status === "ready" && row.payload) {
    const parsed = TopicSchema.safeParse(row.payload);
    if (parsed.success) return { status: "ready", topic: parsed.data };
  }
  if (row?.status === "pending") {
    if (!isStalePending(row)) {
      return {
        status: "pending",
        viewsDone: row.progress?.viewsDone ?? 0,
        ...(row.progress?.partial ? { partial: row.progress.partial } : {}),
      };
    }
  }
  const seed = await getSeedTopic(slug);
  if (seed) return { status: "ready", topic: seed };
  if (row?.status === "pending") {
    return { status: "error", message: "Writing this topic took too long. Please try again in a few minutes." };
  }
  if (row?.status === "error") {
    return { status: "error", message: "We couldn't finish writing this topic. Please try again in a few minutes." };
  }
  return { status: "missing" };
}

/** Simple word search over titles and questions (seeds included). Best matches first. */
export async function searchTopics(q: string, limit = 12): Promise<TopicSummary[]> {
  const all = await listTopics();
  const words = [...new Set(q.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/))]
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .slice(0, 10);
  if (words.length === 0) return all.slice(0, limit);
  return all
    .map((t) => {
      const hay = `${t.title} ${t.question} ${t.slug.replace(/-/g, " ")}`.toLowerCase();
      const title = t.title.toLowerCase();
      let score = 0;
      for (const w of words) {
        const stem = w.length > 4 ? w.replace(/(ing|ism|ist|ed|es|s)$/, "") : w;
        if (title.includes(stem)) score += 3;
        else if (hay.includes(stem)) score += 1;
      }
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "what", "does", "did", "how", "why", "who", "whom", "which", "about", "with",
  "that", "this", "these", "those", "from", "into", "should", "would", "could", "can", "will", "was", "were",
  "has", "have", "had", "his", "her", "its", "our", "your", "their", "they", "them", "you", "not", "but",
  "all", "any", "view", "views", "christian", "christians", "christianity", "bible", "biblical", "say", "says",
  "think", "believe", "teach", "teaches", "according", "different", "traditions", "tradition",
]);
