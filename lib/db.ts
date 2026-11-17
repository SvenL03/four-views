// Data layer. Neon (Postgres over HTTP) when DATABASE_URL is set; otherwise an
// in-process memory store so local development still works (seeds + mock engine).
// The connection string only ever comes from the environment, never from code.
import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Topic, TopicSummary, TraditionId } from "./schema";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

/** Tagged-template SQL helper, or null when no database is configured. */
export const sql: NeonQueryFunction<false, false> | null = url ? neon(url) : null;

export function hasDatabase(): boolean {
  return sql !== null;
}

export type TopicStatus = "pending" | "ready" | "error";

/** What we keep in topics.partial while a topic is being written. */
export interface StoredProgress {
  stage: string;
  viewsDone: number;
  partial?: Partial<Topic>;
}

export interface TopicRow {
  slug: string;
  title: string;
  question: string;
  status: TopicStatus;
  payload: Topic | null;
  progress: StoredProgress | null;
  tradIds: string[];
  engine: string | null;
  model: string | null;
  costUsd: number;
  createdAt: Date;
  updatedAt: Date;
  error: string | null;
}

/** A pending row not touched for this long is treated as dead (the function was killed). */
export const PENDING_STALE_MS = 6 * 60 * 1000;
/** A failed topic may be tried again after this long. */
export const ERROR_RETRY_MS = 10 * 60 * 1000;

export function isStalePending(row: Pick<TopicRow, "status" | "updatedAt">): boolean {
  return row.status === "pending" && Date.now() - row.updatedAt.getTime() > PENDING_STALE_MS;
}

// ---------------------------------------------------------------------------
// Memory backend (no DATABASE_URL). Shared through globalThis so route handlers
// and pages in the same process see the same data.
interface MemStore {
  topics: Map<string, TopicRow>;
  aliases: Map<string, string>;
}
function mem(): MemStore {
  const g = globalThis as typeof globalThis & { __fourViewsMem?: MemStore };
  g.__fourViewsMem ??= { topics: new Map(), aliases: new Map() };
  return g.__fourViewsMem;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(r: Record<string, any>): TopicRow {
  return {
    slug: r.slug,
    title: r.title,
    question: r.question,
    status: r.status,
    payload: r.payload ?? null,
    progress: r.partial ?? null,
    tradIds: r.trad_ids ?? [],
    engine: r.engine ?? null,
    model: r.model ?? null,
    costUsd: Number(r.cost_usd ?? 0),
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    error: r.error ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getTopicRow(slug: string): Promise<TopicRow | null> {
  if (!sql) return mem().topics.get(slug) ?? null;
  const rows = await sql`SELECT * FROM topics WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

/** The ready topic's payload only (cheaper than the whole row). */
export async function getReadyPayload(slug: string): Promise<Topic | null> {
  if (!sql) {
    const r = mem().topics.get(slug);
    return r?.status === "ready" ? r.payload : null;
  }
  const rows = await sql`SELECT payload FROM topics WHERE slug = ${slug} AND status = 'ready' LIMIT 1`;
  return (rows[0]?.payload as Topic | undefined) ?? null;
}

/** Ready topics as summaries, newest first. */
export async function listReadySummaries(limit = 500): Promise<TopicSummary[]> {
  if (!sql) {
    return [...mem().topics.values()]
      .filter((r) => r.status === "ready" && r.payload)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((r) => ({
        slug: r.slug,
        title: r.title,
        question: r.question,
        traditionIds: r.tradIds as TraditionId[],
        generatedAt: r.payload!.meta.generatedAt,
      }));
  }
  const rows = await sql`
    SELECT slug, title, question, trad_ids,
           COALESCE(payload->'meta'->>'generatedAt', to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS generated_at
    FROM topics WHERE status = 'ready'
    ORDER BY updated_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    question: r.question,
    traditionIds: (r.trad_ids ?? []) as TraditionId[],
    generatedAt: r.generated_at,
  }));
}

/** Exact slug or case-insensitive title match, any status. */
export async function findTopicBySlugOrTitle(slug: string, title: string): Promise<TopicRow | null> {
  if (!sql) {
    const t = title.trim().toLowerCase();
    for (const r of mem().topics.values()) {
      if (r.slug === slug || r.title.toLowerCase() === t) return r;
    }
    return null;
  }
  const rows = await sql`
    SELECT * FROM topics WHERE slug = ${slug} OR lower(title) = lower(${title.trim()})
    ORDER BY (status = 'ready') DESC LIMIT 1`;
  return rows[0] ? toRow(rows[0]) : null;
}

export interface PendingInput {
  slug: string;
  title: string;
  question: string;
  tradIds: string[];
  engine: string;
  model: string;
}

/**
 * Claims a slug for generation. Returns true only for the one caller that
 * inserted the row (or took over a dead/failed one), so two visitors never pay twice.
 */
export async function claimPending(p: PendingInput): Promise<boolean> {
  if (!sql) {
    const m = mem().topics;
    const existing = m.get(p.slug);
    const now = new Date();
    if (
      existing &&
      !(isStalePending(existing) ||
        (existing.status === "error" && now.getTime() - existing.updatedAt.getTime() > ERROR_RETRY_MS))
    ) {
      return false;
    }
    m.set(p.slug, {
      slug: p.slug, title: p.title, question: p.question, status: "pending",
      payload: null, progress: { stage: "plan", viewsDone: 0 }, tradIds: p.tradIds,
      engine: p.engine, model: p.model, costUsd: 0, createdAt: now, updatedAt: now, error: null,
    });
    return true;
  }
  const progress = JSON.stringify({ stage: "plan", viewsDone: 0 } satisfies StoredProgress);
  const staleSec = Math.round(PENDING_STALE_MS / 1000);
  const retrySec = Math.round(ERROR_RETRY_MS / 1000);
  const rows = await sql`
    INSERT INTO topics (slug, title, question, status, partial, trad_ids, engine, model)
    VALUES (${p.slug}, ${p.title}, ${p.question}, 'pending', ${progress}::jsonb, ${p.tradIds}::text[], ${p.engine}, ${p.model})
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, question = EXCLUDED.question, status = 'pending',
      partial = EXCLUDED.partial, payload = NULL, trad_ids = EXCLUDED.trad_ids,
      engine = EXCLUDED.engine, model = EXCLUDED.model, error = NULL, updated_at = now()
    WHERE (topics.status = 'pending' AND topics.updated_at < now() - make_interval(secs => ${staleSec}))
       OR (topics.status = 'error' AND topics.updated_at < now() - make_interval(secs => ${retrySec}))
    RETURNING slug`;
  return rows.length > 0;
}

export async function savePartial(slug: string, progress: StoredProgress): Promise<void> {
  if (!sql) {
    const r = mem().topics.get(slug);
    if (r && r.status === "pending") Object.assign(r, { progress, updatedAt: new Date() });
    return;
  }
  await sql`
    UPDATE topics SET partial = ${JSON.stringify(progress)}::jsonb, updated_at = now()
    WHERE slug = ${slug} AND status = 'pending'`;
}

export async function markReady(topic: Topic, costUsd: number): Promise<void> {
  if (!sql) {
    const r = mem().topics.get(topic.slug);
    const now = new Date();
    mem().topics.set(topic.slug, {
      slug: topic.slug, title: topic.title, question: topic.question, status: "ready",
      payload: topic, progress: null, tradIds: topic.traditionIds, engine: topic.meta.engine,
      model: topic.meta.model ?? null, costUsd, createdAt: r?.createdAt ?? now, updatedAt: now, error: null,
    });
    return;
  }
  await sql`
    UPDATE topics SET status = 'ready', payload = ${JSON.stringify(topic)}::jsonb, partial = NULL,
      title = ${topic.title}, question = ${topic.question}, trad_ids = ${topic.traditionIds}::text[],
      engine = ${topic.meta.engine}, model = ${topic.meta.model ?? null}, cost_usd = ${costUsd},
      error = NULL, updated_at = now()
    WHERE slug = ${topic.slug}`;
}

export async function markError(slug: string, message: string, costUsd = 0): Promise<void> {
  const msg = message.slice(0, 500);
  if (!sql) {
    const r = mem().topics.get(slug);
    if (r) Object.assign(r, { status: "error", error: msg, costUsd, updatedAt: new Date() });
    return;
  }
  await sql`
    UPDATE topics SET status = 'error', error = ${msg}, cost_usd = ${costUsd}, updated_at = now()
    WHERE slug = ${slug} AND status = 'pending'`;
}

export async function getAlias(queryKey: string): Promise<string | null> {
  if (!sql) return mem().aliases.get(queryKey) ?? null;
  const rows = await sql`SELECT slug FROM aliases WHERE query_key = ${queryKey} LIMIT 1`;
  return (rows[0]?.slug as string | undefined) ?? null;
}

export async function setAlias(queryKey: string, slug: string): Promise<void> {
  if (!queryKey) return;
  if (!sql) {
    mem().aliases.set(queryKey, slug);
    return;
  }
  await sql`
    INSERT INTO aliases (query_key, slug) VALUES (${queryKey}, ${slug})
    ON CONFLICT (query_key) DO UPDATE SET slug = EXCLUDED.slug`;
}
