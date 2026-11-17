// The pipeline: plan, then four views in parallel, then the synthesis, then validation.
// Engines (anthropic, perplexity, mock) supply only the three model calls below.
import type { Source, Topic, TraditionId, View } from "../schema";
import { activeTraditions, tradition } from "../traditions";
import { EngineError, isAbort } from "./errors";
import { guardQuery } from "./guard";
import { getLibrary } from "./library";
import type { OkPlan, PlanOut, SynthesisOut, ViewOut } from "./prompts";
import type { Engine, GenerateOptions, PlanResult } from "./types";
import { cleanView, validateTopic } from "./validate";

export interface ViewContext {
  plan: OkPlan;
  traditionId: TraditionId;
  library: Source[];
  searchDomains: string[];
}

export interface ModelCalls {
  name: string;
  model: string;
  plan(query: string, signal?: AbortSignal): Promise<{ out: PlanOut; costUsd: number }>;
  /** seenUrls: every URL the provider actually returned (search results, fetched pages, citations). */
  view(ctx: ViewContext, signal?: AbortSignal): Promise<{ out: ViewOut; seenUrls: string[]; costUsd: number }>;
  synthesis(plan: OkPlan, views: View[], signal?: AbortSignal): Promise<{ out: SynthesisOut; costUsd: number }>;
}

export interface GenerateResult {
  topic: Topic;
  costUsd: number;
  warnings: string[];
}

/** An Engine whose generate() also reports warnings. */
export interface PipelineEngine extends Engine {
  calls: ModelCalls;
  generateWithWarnings(plan: OkPlan, opts?: GenerateOptions): Promise<GenerateResult>;
}

const PREFERRED_FILL: TraditionId[] = ["reformed", "arminian", "charismatic", "mainline_liberal", "conservative_evangelical", "dispensationalist"];

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
}

/** Turn the model's plan output into a PlanResult the app can trust. */
export function finishPlan(out: PlanOut, query: string): PlanResult {
  if (out.classification !== "ok") {
    const fallback: Record<string, string> = {
      "off-topic": "Four Views compares how Christian traditions answer theological and church-practice questions. Try a topic like baptism or the Lord's Supper.",
      "bad-faith": "Four Views presents each tradition in its own best terms. Try asking the underlying question neutrally.",
      harmful: "Four Views can't help with that. Try a question about Christian belief or practice.",
      "too-vague": "That's a bit broad to compare fairly. Try a sharper question.",
    };
    const suggestion = out.suggestion.trim();
    return {
      kind: "rejected",
      reason: out.classification,
      message: out.message.trim() || fallback[out.classification],
      ...(suggestion && out.classification !== "harmful" ? { suggestion } : {}),
    };
  }
  const active = new Set(activeTraditions().map((t) => t.id));
  const ids: TraditionId[] = [];
  for (const id of out.traditionIds) if (active.has(id) && !ids.includes(id)) ids.push(id);
  for (const id of [...PREFERRED_FILL, ...active] as TraditionId[]) {
    if (ids.length >= 4) break;
    if (active.has(id) && !ids.includes(id)) ids.push(id);
  }
  const title = out.title.trim() || query.slice(0, 60);
  const slug = slugify(out.slug) || slugify(title) || "topic";
  return {
    kind: "ok",
    slug,
    title,
    question: out.question.trim() || title,
    intro: out.intro.trim(),
    traditionIds: ids.slice(0, 4),
    whyTheseFour: out.whyTheseFour.trim(),
  };
}

function toView(out: ViewOut, traditionId: TraditionId): View {
  return {
    traditionId,
    headline: out.headline,
    body: out.body,
    keyTexts: out.keyTexts,
    sources: out.sources.map((s, i) => ({
      id: `s${i + 1}`,
      title: s.title,
      ...(s.author ? { author: s.author } : {}),
      ...(s.publisher ? { publisher: s.publisher } : {}),
      ...(s.year !== undefined ? { year: s.year } : {}),
      url: s.url,
      kind: s.kind,
      ...(s.locator ? { locator: s.locator } : {}),
    })),
    consensus: out.consensus,
    ...(out.consensusNote ? { consensusNote: out.consensusNote } : {}),
  };
}

/** Engines attach costUsd to errors thrown after a paid call, so failed attempts still count. */
function spentOn(e: unknown): number {
  const c = (e as { costUsd?: unknown } | null)?.costUsd;
  return typeof c === "number" && Number.isFinite(c) ? c : 0;
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new EngineError("aborted", "Generation was cancelled.");
}

async function oneView(
  calls: ModelCalls,
  plan: OkPlan,
  traditionId: TraditionId,
  signal: AbortSignal | undefined,
): Promise<{ view: View; known: string[]; costUsd: number; warnings: string[] }> {
  const lib = getLibrary(traditionId);
  let cost = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    checkAbort(signal);
    try {
      const r = await calls.view({ plan, traditionId, library: lib.sources, searchDomains: lib.searchDomains }, signal);
      cost += r.costUsd;
      const known = [...r.seenUrls, ...lib.sources.map((s) => s.url)];
      const cleaned = cleanView(toView(r.out, traditionId), { knownUrls: known });
      if (cleaned.view.sources.length && cleaned.view.body.length) {
        return { view: cleaned.view, known, costUsd: cost, warnings: cleaned.warnings };
      }
      lastError = new EngineError("unsourced", `${traditionId}: no cited source survived the URL check`, true);
    } catch (e) {
      if (isAbort(e)) throw e;
      cost += spentOn(e);
      lastError = e;
      // Only retry what a second attempt can fix.
      if (!(e instanceof EngineError) || !["invalid-output", "unsourced", "truncated", "upstream"].includes(e.code)) break;
    }
  }
  if (lastError instanceof EngineError) {
    lastError.message = `${tradition(traditionId).name} view: ${lastError.message}`;
    throw lastError;
  }
  throw lastError instanceof Error ? lastError : new EngineError("upstream", String(lastError));
}

async function pipelineGenerate(calls: ModelCalls, plan: OkPlan, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const { onProgress, signal } = opts;
  const ids = plan.traditionIds as TraditionId[];
  let cost = 0;
  const warnings: string[] = [];
  const done: (View | undefined)[] = [undefined, undefined, undefined, undefined];
  const known = new Set<string>();
  const header = {
    slug: plan.slug,
    title: plan.title,
    question: plan.question,
    intro: plan.intro,
    traditionIds: ids,
    whyTheseFour: plan.whyTheseFour,
  };

  await onProgress?.({ stage: "views", viewsDone: 0, partial: { ...header, views: [] } });
  let viewsDone = 0;
  // Abort the siblings if one view fails for good, so we stop paying for a topic we can't finish.
  const inner = new AbortController();
  const onOuterAbort = () => inner.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });
  try {
    await Promise.all(
      ids.map(async (id, i) => {
        try {
          const r = await oneView(calls, plan, id, inner.signal);
          cost += r.costUsd;
          warnings.push(...r.warnings);
          r.known.forEach((u) => known.add(u));
          done[i] = r.view;
          viewsDone++;
          await onProgress?.({
            stage: "views",
            viewsDone,
            partial: { ...header, views: done.filter((v): v is View => !!v) },
          });
        } catch (e) {
          inner.abort();
          throw e;
        }
      }),
    );
  } catch (e) {
    if (signal?.aborted) throw new EngineError("aborted", "Generation was cancelled.");
    throw e;
  } finally {
    signal?.removeEventListener("abort", onOuterAbort);
  }
  const views = done as View[];

  checkAbort(signal);
  await onProgress?.({ stage: "synthesis", viewsDone: 4, partial: { ...header, views } });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    checkAbort(signal);
    try {
      const s = await calls.synthesis(plan, views, signal);
      cost += s.costUsd;
      const topic: Topic = {
        ...header,
        views,
        synthesis: s.out,
        meta: {
          version: 2,
          generatedAt: new Date().toISOString(),
          engine: calls.name,
          model: calls.model,
          costUsd: Math.round(cost * 10000) / 10000,
          reviewed: false,
        },
      };
      const v = validateTopic(topic, { knownUrls: known });
      v.topic.meta.costUsd = Math.round(cost * 10000) / 10000;
      warnings.push(...v.warnings);
      await onProgress?.({ stage: "done", viewsDone: 4, partial: v.topic });
      return { topic: v.topic, costUsd: cost, warnings };
    } catch (e) {
      if (isAbort(e)) throw e;
      cost += spentOn(e);
      lastError = e;
      if (!(e instanceof EngineError) || !["invalid-output", "invalid-topic", "truncated", "upstream"].includes(e.code)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new EngineError("upstream", String(lastError));
}

/** Wrap three model calls into an Engine that runs the shared pipeline. */
export function engineFrom(calls: ModelCalls): PipelineEngine {
  return {
    name: calls.name,
    model: calls.model,
    calls,
    async plan(query: string) {
      const r = await calls.plan(query);
      return { result: finishPlan(r.out, query), costUsd: r.costUsd };
    },
    async generate(plan, opts) {
      const r = await pipelineGenerate(calls, plan, opts);
      return { topic: r.topic, costUsd: r.costUsd };
    },
    generateWithWarnings(plan, opts) {
      return pipelineGenerate(calls, plan, opts);
    },
  };
}

/** Guard, then classify and plan. Never spends money on a query the guard rejects. */
export async function runPlan(engine: Engine, query: string): Promise<{ result: PlanResult; costUsd: number }> {
  const g = guardQuery(query);
  if (!g.ok) return { result: { kind: "rejected", reason: "too-vague", message: g.message }, costUsd: 0 };
  return engine.plan(g.query);
}

/** Views in parallel (onProgress after each), then the synthesis, then validation. */
export async function generateTopic(
  engine: Engine,
  plan: OkPlan,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  if ("generateWithWarnings" in engine && typeof (engine as PipelineEngine).generateWithWarnings === "function") {
    return (engine as PipelineEngine).generateWithWarnings(plan, opts);
  }
  const r = await engine.generate(plan, opts);
  const v = validateTopic(r.topic);
  return { topic: v.topic, costUsd: r.costUsd, warnings: v.warnings };
}
