// Visitor limits and the daily spend cap. Public site, paid model calls: every
// path that can spend money goes through here first.
//
// Visitors are identified by sha256(ip | UTC day | secret), so raw IPs are never
// stored and the id changes every day. Windows are fixed (clock hour, UTC day).
//
// With a database, counters live in the `rate` and `spend` tables (shared by all
// serverless instances). Without one, an in-memory fallback is used and the
// engine counts as paused unless ENGINE=mock, so cost can never run untracked.
import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** New topics a visitor may start. */
export const NEW_TOPICS_PER_HOUR = 3;
export const NEW_TOPICS_PER_DAY = 8;
/** Plan calls (cheap, but not free). Rejected or already-written queries only count here. */
export const PLANS_PER_HOUR = 12;
export const PLANS_PER_DAY = 30;

export function dailySpendCapUsd(): number {
  return envNumber("DAILY_SPEND_CAP_USD", 2);
}
export function dailyGenerationCap(): number {
  return Math.floor(envNumber("DAILY_GENERATION_CAP", 25));
}
/** Held against the cap while a topic is being written; replaced by the real cost when it finishes. */
export function generationEstimateUsd(): number {
  // Defaults follow the engine's estimated cost per new topic (docs/REWORK-PLAN.md › Before and after).
  const engine = process.env.ENGINE;
  const fallback =
    engine === "mock" ? 0 : engine === "perplexity" || !process.env.ANTHROPIC_API_KEY ? 0.2 : 1.5;
  return envNumber("GENERATION_COST_ESTIMATE_USD", fallback);
}

/** Paid generation may only run when its cost can be tracked (a database), or with the free mock engine. */
export function engineMayRun(engineName?: string): boolean {
  return sql !== null || process.env.ENGINE === "mock" || engineName === "mock";
}

// ---------------------------------------------------------------------------
// Visitor identity

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Daily-rotating, salted hash of the visitor's IP. The raw IP is never stored. */
export function visitorId(req: Request): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.VERCEL_PROJECT_ID || "four-views-local";
  return createHash("sha256").update(`${clientIp(req)}|${utcDay()}|${secret}`).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Counters

interface Counter {
  count: number;
  expiresAt: number; // epoch ms
}
interface MemLimits {
  rate: Map<string, Counter>;
  spend: Map<string, { usd: number; generations: number }>;
}
function mem(): MemLimits {
  const g = globalThis as typeof globalThis & { __fourViewsLimits?: MemLimits };
  g.__fourViewsLimits ??= { rate: new Map(), spend: new Map() };
  return g.__fourViewsLimits;
}

function hourWindow(): { index: number; expiresAt: number } {
  const index = Math.floor(Date.now() / 3_600_000);
  return { index, expiresAt: (index + 1) * 3_600_000 };
}
function dayWindowEnd(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

async function bump(bucket: string, expiresAt: number): Promise<Counter> {
  if (!sql) {
    const m = mem().rate;
    const now = Date.now();
    const c = m.get(bucket);
    const next = c && c.expiresAt > now ? { count: c.count + 1, expiresAt: c.expiresAt } : { count: 1, expiresAt };
    m.set(bucket, next);
    if (m.size > 5000) for (const [k, v] of m) if (v.expiresAt <= now) m.delete(k);
    return next;
  }
  const rows = await sql`
    INSERT INTO rate (bucket, count, expires_at) VALUES (${bucket}, 1, ${new Date(expiresAt).toISOString()}::timestamptz)
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE WHEN rate.expires_at <= now() THEN 1 ELSE rate.count + 1 END,
      expires_at = CASE WHEN rate.expires_at <= now() THEN EXCLUDED.expires_at ELSE rate.expires_at END
    RETURNING count, expires_at`;
  if (Math.random() < 0.02) {
    await sql`DELETE FROM rate WHERE expires_at < now() - interval '1 hour'`;
  }
  return { count: Number(rows[0].count), expiresAt: new Date(rows[0].expires_at).getTime() };
}

async function unbump(bucket: string): Promise<void> {
  if (!sql) {
    const c = mem().rate.get(bucket);
    if (c) c.count = Math.max(0, c.count - 1);
    return;
  }
  await sql`UPDATE rate SET count = GREATEST(count - 1, 0) WHERE bucket = ${bucket}`;
}

async function peek(bucket: string): Promise<Counter | null> {
  if (!sql) {
    const c = mem().rate.get(bucket);
    return c && c.expiresAt > Date.now() ? c : null;
  }
  const rows = await sql`SELECT count, expires_at FROM rate WHERE bucket = ${bucket} AND expires_at > now()`;
  return rows[0] ? { count: Number(rows[0].count), expiresAt: new Date(rows[0].expires_at).getTime() } : null;
}

function retryAfter(expiresAt: number): number {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function buckets(kind: "new" | "plan", visitor: string) {
  const h = hourWindow();
  return {
    hour: { key: `${kind}:h:${visitor}:${h.index}`, expiresAt: h.expiresAt },
    day: { key: `${kind}:d:${visitor}`, expiresAt: dayWindowEnd() },
  };
}

/** Read-only check: may this visitor start another new topic? (Avoids paying for a plan we can't use.) */
export async function checkNewTopicAllowance(visitor: string): Promise<LimitResult> {
  const b = buckets("new", visitor);
  const [h, d] = await Promise.all([peek(b.hour.key), peek(b.day.key)]);
  if (d && d.count >= NEW_TOPICS_PER_DAY) return { ok: false, retryAfterSeconds: retryAfter(d.expiresAt) };
  if (h && h.count >= NEW_TOPICS_PER_HOUR) return { ok: false, retryAfterSeconds: retryAfter(h.expiresAt) };
  return { ok: true };
}

/** Counts one plan call for this visitor (the light limit). */
export async function takePlanAttempt(visitor: string): Promise<LimitResult> {
  const b = buckets("plan", visitor);
  const [h, d] = await Promise.all([bump(b.hour.key, b.hour.expiresAt), bump(b.day.key, b.day.expiresAt)]);
  if (d.count > PLANS_PER_DAY) return { ok: false, retryAfterSeconds: retryAfter(d.expiresAt) };
  if (h.count > PLANS_PER_HOUR) return { ok: false, retryAfterSeconds: retryAfter(h.expiresAt) };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Daily spend (all visitors)

export interface BudgetStatus {
  ok: boolean;
  day: string;
  usd: number;
  generations: number;
  capUsd: number;
  capGenerations: number;
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const day = utcDay();
  let usd = 0;
  let generations = 0;
  if (!sql) {
    const s = mem().spend.get(day);
    usd = s?.usd ?? 0;
    generations = s?.generations ?? 0;
  } else {
    const rows = await sql`SELECT usd, generations FROM spend WHERE day = ${day}::date`;
    usd = Number(rows[0]?.usd ?? 0);
    generations = Number(rows[0]?.generations ?? 0);
  }
  const capUsd = dailySpendCapUsd();
  const capGenerations = dailyGenerationCap();
  // "ok" means one more topic could still be reserved, so we never pay for a plan we can't use.
  const ok = usd + generationEstimateUsd() <= capUsd && generations < capGenerations;
  return { ok, day, usd, generations, capUsd, capGenerations };
}

async function addSpend(day: string, usd: number, generations: number): Promise<{ usd: number; generations: number }> {
  if (!sql) {
    const m = mem().spend;
    const s = m.get(day) ?? { usd: 0, generations: 0 };
    s.usd = Math.max(0, s.usd + usd);
    s.generations = Math.max(0, s.generations + generations);
    m.set(day, s);
    return { ...s };
  }
  const rows = await sql`
    INSERT INTO spend (day, usd, generations) VALUES (${day}::date, ${Math.max(0, usd)}, ${Math.max(0, generations)})
    ON CONFLICT (day) DO UPDATE SET
      usd = GREATEST(spend.usd + ${usd}, 0),
      generations = GREATEST(spend.generations + ${generations}, 0)
    RETURNING usd, generations`;
  return { usd: Number(rows[0].usd), generations: Number(rows[0].generations) };
}

/** Records the cost of a model call that is already paid (e.g. a plan). */
export async function recordSpend(usd: number): Promise<void> {
  if (!(usd > 0)) return;
  await addSpend(utcDay(), usd, 0);
}

export type Reservation =
  | { ok: true; day: string; estimateUsd: number }
  | { ok: false; reason: "limited"; retryAfterSeconds: number }
  | { ok: false; reason: "paused" };

/**
 * Atomically takes one new-topic slot for the visitor and holds the cost
 * estimate against today's cap. Undone on any refusal.
 */
export async function reserveGeneration(visitor: string): Promise<Reservation> {
  const b = buckets("new", visitor);
  const [h, d] = await Promise.all([bump(b.hour.key, b.hour.expiresAt), bump(b.day.key, b.day.expiresAt)]);
  if (h.count > NEW_TOPICS_PER_HOUR || d.count > NEW_TOPICS_PER_DAY) {
    await Promise.all([unbump(b.hour.key), unbump(b.day.key)]);
    const until = d.count > NEW_TOPICS_PER_DAY ? d.expiresAt : h.expiresAt;
    return { ok: false, reason: "limited", retryAfterSeconds: retryAfter(until) };
  }
  const day = utcDay();
  const estimateUsd = generationEstimateUsd();
  const s = await addSpend(day, estimateUsd, 1);
  if (s.usd > dailySpendCapUsd() || s.generations > dailyGenerationCap()) {
    await Promise.all([addSpend(day, -estimateUsd, -1), unbump(b.hour.key), unbump(b.day.key)]);
    return { ok: false, reason: "paused" };
  }
  return { ok: true, day, estimateUsd };
}

/** Gives a reservation back when no generation was started after all (someone else claimed the topic). */
export async function releaseGeneration(
  visitor: string,
  r: Extract<Reservation, { ok: true }>,
): Promise<void> {
  const b = buckets("new", visitor);
  await Promise.all([addSpend(r.day, -r.estimateUsd, -1), unbump(b.hour.key), unbump(b.day.key)]);
}

/**
 * Replaces the held estimate with the real cost. On failure without a known
 * cost, pass null: the estimate stays counted (conservative).
 */
export async function settleGeneration(
  r: Extract<Reservation, { ok: true }>,
  actualUsd: number | null,
): Promise<void> {
  if (actualUsd === null || !Number.isFinite(actualUsd)) return;
  const delta = actualUsd - r.estimateUsd;
  if (delta !== 0) await addSpend(r.day, delta, 0);
}
