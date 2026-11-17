// POST /api/topics  { query }  -> CreateTopicResponse
// GET  /api/topics?q=...      -> SearchTopicsResponse
//
// Order of checks on POST, cheapest first, so money is only spent when needed:
// guard -> existing topic (alias, slug, title) -> engine/budget -> visitor limits
// -> plan -> planned slug already written -> reserve budget -> claim slug -> write in after().
import { after, NextResponse } from "next/server";
import { z } from "zod";
import type { CreateTopicResponse, SearchTopicsResponse } from "@/lib/api-contract";
import { TopicSchema, type TopicSummary } from "@/lib/schema";
import { generateTopic, getEngine, guardQuery, runPlan } from "@/lib/engine";
import type { Engine, PlanResult, Progress } from "@/lib/engine/types";
import {
  claimPending,
  findTopicBySlugOrTitle,
  getAlias,
  getTopicRow,
  isStalePending,
  markError,
  markReady,
  savePartial,
  setAlias,
} from "@/lib/db";
import {
  budgetStatus,
  checkNewTopicAllowance,
  engineMayRun,
  recordSpend,
  releaseGeneration,
  reserveGeneration,
  settleGeneration,
  takePlanAttempt,
  visitorId,
  type Reservation,
} from "@/lib/limits";
import { getSeedTopic, invalidateTopics, listSeedTopics, listTopics, searchTopics } from "@/lib/topics";

export const maxDuration = 300;

const MAX_BODY_BYTES = 2048;
/** Stop the writer before the function's own limit so the row can be marked as failed. */
const GENERATION_TIMEOUT_MS = 280_000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BodySchema = z.object({ query: z.string().max(500) });

function reply(body: CreateTopicResponse, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Is this slug already written (ready) or being written (pending)? */
async function statusOf(slug: string): Promise<"ready" | "pending" | null> {
  if (!SLUG_RE.test(slug)) return null;
  const row = await getTopicRow(slug).catch(() => null);
  if (row?.status === "ready") return "ready";
  if (row?.status === "pending" && !isStalePending(row)) return "pending";
  if (await getSeedTopic(slug)) return "ready";
  return null;
}

async function findExisting(key: string, query: string): Promise<{ slug: string; status: "ready" | "pending" } | null> {
  const aliased = await getAlias(key).catch(() => null);
  if (aliased) {
    const s = await statusOf(aliased);
    if (s) return { slug: aliased, status: s };
  }
  const candidates = [...new Set([slugify(key), slugify(query)].filter(Boolean))];
  for (const slug of candidates) {
    const s = await statusOf(slug);
    if (s) return { slug, status: s };
  }
  const row = await findTopicBySlugOrTitle(candidates[0] ?? "", query).catch(() => null);
  if (row) {
    if (row.status === "ready") return { slug: row.slug, status: "ready" };
    if (row.status === "pending" && !isStalePending(row)) return { slug: row.slug, status: "pending" };
  }
  const q = query.trim().toLowerCase();
  const k = key.trim().toLowerCase();
  const seed = (await listSeedTopics()).find((t) => t.title.toLowerCase() === q || t.title.toLowerCase() === k);
  return seed ? { slug: seed.slug, status: "ready" } : null;
}

async function suggestionsFor(query: string): Promise<TopicSummary[]> {
  const hits = await searchTopics(query, 6);
  return hits.length ? hits : (await listTopics()).slice(0, 6);
}

async function paused(query: string, message: string) {
  return reply({ status: "paused", message, suggestions: await suggestionsFor(query) });
}

function limited(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const when = minutes >= 90 ? `in about ${Math.round(minutes / 60)} hours` : `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return reply(
    {
      status: "limited",
      message: `You've asked for several new topics in a short time. You can ask for another ${when}; meanwhile, every topic already written is open to read.`,
      retryAfterSeconds,
    },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export async function POST(req: Request) {
  try {
    // 1. Body: small, JSON, { query: string }.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return reply({ status: "error", message: "That request is too large." }, 413);
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply({ status: "error", message: "That request is too large." }, 413);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return reply({ status: "error", message: "Send JSON like {\"query\": \"baptism\"}." }, 400);
    }
    const body = BodySchema.safeParse(data);
    if (!body.success) return reply({ status: "error", message: "Send JSON like {\"query\": \"baptism\"}." }, 400);

    // 2. Cheap checks on the text itself.
    const guard = guardQuery(body.data.query);
    if (!guard.ok) return reply({ status: "rejected", message: guard.message });
    const { query, key } = guard;

    // 3. Already written (or being written)?
    const existing = await findExisting(key, query);
    if (existing) return reply({ status: existing.status, slug: existing.slug });

    // 4. Can anything new be written right now?
    const engine = getEngine();
    if (!engine || !engineMayRun(engine.name)) {
      return paused(query, "New topics aren't being written right now. Here are topics already written that may help.");
    }
    const budget = await budgetStatus();
    if (!budget.ok) {
      return paused(query, "Today's budget for new topics is used up; new topics open again tomorrow (UTC). Here are related topics already written.");
    }

    // 5. Visitor limits (no raw IP is stored).
    const visitor = visitorId(req);
    const allowance = await checkNewTopicAllowance(visitor);
    if (!allowance.ok) return limited(allowance.retryAfterSeconds);
    const planToken = await takePlanAttempt(visitor);
    if (!planToken.ok) return limited(planToken.retryAfterSeconds);

    // 6. Plan: is it answerable, and which four traditions?
    let planned: { result: PlanResult; costUsd: number };
    try {
      planned = await runPlan(engine, query);
    } catch (e) {
      console.error("[api/topics] plan failed:", e);
      return reply({ status: "error", message: "We couldn't start on that question just now. Please try again in a minute." }, 502);
    }
    await recordSpend(planned.costUsd).catch((e) => console.error("[api/topics] spend record failed:", e));
    const result = planned.result;
    if (result.kind === "rejected") {
      return reply({ status: "rejected", message: result.message, ...(result.suggestion ? { suggestion: result.suggestion } : {}) });
    }

    const slug = SLUG_RE.test(result.slug) ? result.slug : slugify(result.slug || result.title);
    if (!slug) return reply({ status: "error", message: "We couldn't name that topic. Please rephrase it." }, 500);
    const plan = { ...result, slug };

    // 7. The planner may map a new phrasing onto a topic that already exists.
    const already = await statusOf(slug);
    if (already) {
      await setAlias(key, slug).catch(() => {});
      return reply({ status: already, slug });
    }

    // 8. Reserve budget, then claim the slug so two visitors never pay for the same topic.
    const reservation = await reserveGeneration(visitor);
    if (!reservation.ok) {
      if (reservation.reason === "limited") return limited(reservation.retryAfterSeconds);
      return paused(query, "Today's budget for new topics is used up; new topics open again tomorrow (UTC). Here are related topics already written.");
    }
    const claimed = await claimPending({
      slug,
      title: plan.title,
      question: plan.question,
      tradIds: plan.traditionIds,
      engine: engine.name,
      model: engine.model,
    });
    if (!claimed) {
      await releaseGeneration(visitor, reservation);
      const s = await statusOf(slug);
      if (s) {
        await setAlias(key, slug).catch(() => {});
        return reply({ status: s, slug });
      }
      return reply({ status: "error", message: "This topic failed a moment ago. Please try again in a few minutes." }, 503);
    }
    await setAlias(key, slug).catch(() => {});

    // 9. Write it after the response; the page polls GET /api/topics/{slug}.
    after(() => writeTopic(engine, plan, reservation));
    return reply({ status: "pending", slug }, 202);
  } catch (e) {
    console.error("[api/topics] POST failed:", e);
    return reply({ status: "error", message: "Something went wrong on our side. Please try again." }, 500);
  }
}

async function writeTopic(
  engine: Engine,
  plan: Extract<PlanResult, { kind: "ok" }>,
  reservation: Extract<Reservation, { ok: true }>,
): Promise<void> {
  let lastKey = "";
  let lastAt = 0;
  try {
    const { topic, costUsd } = await generateTopic(engine, plan, {
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
      onProgress: async (p: Progress) => {
        const k = `${p.stage}:${p.viewsDone}`;
        const now = Date.now();
        if (k === lastKey && now - lastAt < 2000) return;
        lastKey = k;
        lastAt = now;
        await savePartial(plan.slug, { stage: p.stage, viewsDone: p.viewsDone, partial: p.partial }).catch((e) =>
          console.error("[api/topics] progress write failed:", e),
        );
      },
    });
    const checked = TopicSchema.safeParse({
      ...topic,
      slug: plan.slug,
      meta: { ...topic.meta, costUsd: topic.meta?.costUsd ?? costUsd },
    });
    if (!checked.success) {
      const issue = checked.error.issues[0];
      throw new Error(`topic failed the schema check at ${issue?.path.join(".")}: ${issue?.message}`);
    }
    await markReady(checked.data, costUsd);
    await settleGeneration(reservation, costUsd).catch((e) => console.error("[api/topics] spend settle failed:", e));
    invalidateTopics(plan.slug);
  } catch (e) {
    console.error(`[api/topics] writing "${plan.slug}" failed:`, e);
    await markError(plan.slug, e instanceof Error ? e.message : String(e)).catch(() => {});
    // Cost unknown on failure: the held estimate stays counted against today's cap.
    await settleGeneration(reservation, null).catch(() => {});
  }
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 200);
  try {
    const topics = q.trim() ? await searchTopics(q, 12) : (await listTopics()).slice(0, 50);
    const body: SearchTopicsResponse = { topics };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("[api/topics] search failed:", e);
    const body: SearchTopicsResponse = { topics: [] };
    return NextResponse.json(body, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
