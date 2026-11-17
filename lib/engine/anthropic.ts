// Anthropic engine: Claude with the web search server tool, restricted per tradition.
// Model, tool versions, beta flags and prices follow the claude-api skill (cached 2026-11-03)
// and the published pricing page (checked 2026-11-16).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { View } from "../schema";
import { activeTraditions, tradition, TRADITIONS } from "../traditions";
import { EngineError } from "./errors";
import { engineFrom, type ModelCalls, type PipelineEngine, type ViewContext } from "./pipeline";
import {
  planSystem,
  planUser,
  PlanOutSchema,
  repairSystem,
  repairUser,
  synthesisSystem,
  synthesisUser,
  SynthesisOutSchema,
  viewSystem,
  viewUser,
  ViewOutSchema,
  type OkPlan,
  type PlanOut,
  type ViewOut,
} from "./prompts";

export const ANTHROPIC_MODEL = "claude-opus-5-5";
/** Server-side refusal fallback (opt-in, recommended for this model by the claude-api skill). */
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

/** USD per million tokens. cw = 5-minute cache write, cr = cache read. */
const PRICES: Record<string, { in: number; out: number; cw: number; cr: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cw: 5, cr: 0.2 },
  "claude-opus-5": { in: 5, out: 25, cw: 6.25, cr: 0.5 },
  "claude-opus-4-8": { in: 5, out: 25, cw: 6.25, cr: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cw: 2.5, cr: 0.1 },
};
/** Web search: $10 per 1,000 searches. Web fetch has no per-use fee. */
export const WEB_SEARCH_USD = 10 / 1000;

type TokenCounts = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

function tokensUsd(u: TokenCounts, model: string | null | undefined): number {
  const p = PRICES[model ?? ""] ?? PRICES[ANTHROPIC_MODEL];
  return (
    ((u.input_tokens ?? 0) * p.in +
      (u.output_tokens ?? 0) * p.out +
      (u.cache_creation_input_tokens ?? 0) * p.cw +
      (u.cache_read_input_tokens ?? 0) * p.cr) /
    1e6
  );
}

/** Cost of one response: tokens (per model when a fallback served part of it) + searches. */
export function anthropicCost(usage: Anthropic.Beta.BetaUsage | null | undefined): number {
  if (!usage) return 0;
  const iterations = (usage.iterations ?? []) as Array<TokenCounts & { type?: string; model?: string | null }>;
  const fallbackServed = iterations.some((it) => it.type === "fallback_message");
  let usd = fallbackServed
    ? iterations.reduce((sum, it) => sum + tokensUsd(it, it.model), 0)
    : tokensUsd(usage, ANTHROPIC_MODEL);
  usd += (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
  return usd;
}

function mapError(e: unknown, what: string): never {
  if (e instanceof EngineError) throw e;
  if (e instanceof Anthropic.APIUserAbortError) throw new EngineError("aborted", `${what}: cancelled`);
  if (e instanceof Anthropic.RateLimitError) throw new EngineError("rate-limited", `${what}: rate limited (429)`, true);
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    throw new EngineError("auth", `${what}: Anthropic rejected the API key (${e.status})`);
  }
  if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError || e instanceof Anthropic.UnprocessableEntityError) {
    throw new EngineError("bad-request", `${what}: request rejected (${e.status}): ${e.message.slice(0, 300)}`);
  }
  if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
    throw new EngineError("upstream", `${what}: Anthropic unavailable (${e instanceof Anthropic.APIError ? e.status ?? "network" : "network"})`, true);
  }
  if (e instanceof Anthropic.APIError) throw new EngineError("upstream", `${what}: API error ${e.status ?? ""}`, true);
  throw new EngineError("upstream", `${what}: ${e instanceof Error ? e.message : String(e)}`, true);
}

function checkStop(msg: Anthropic.Beta.BetaMessage, what: string) {
  if (msg.stop_reason === "refusal") {
    throw new EngineError("refused", `${what}: the model declined${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ""}`);
  }
  if (msg.stop_reason === "max_tokens") throw new EngineError("truncated", `${what}: output hit max_tokens`, true);
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** Pull a JSON object out of model text: last ```json fence, then the outermost braces. */
export function extractJson(text: string): unknown {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const open = text.lastIndexOf("```json");
  if (open >= 0 && !text.slice(open + 7).includes("```")) fences.push(text.slice(open + 7));
  for (const f of fences.reverse()) {
    try {
      return JSON.parse(f.trim());
    } catch {
      /* try next */
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
  throw new Error("no JSON object in the reply");
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>\\)\]]+/g;

/** Every URL a server tool actually returned: search results, fetched pages, citations, filtered output. */
export function collectReturnedUrls(content: unknown[], into: Set<string>): void {
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const type = String(b.type ?? "");
    if (type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as Array<Record<string, unknown>>) if (typeof r?.url === "string") into.add(r.url);
    } else if (type === "web_fetch_tool_result") {
      const c = b.content as Record<string, unknown> | undefined;
      if (c && c.type === "web_fetch_result" && typeof c.url === "string") into.add(c.url);
    } else if (type === "text" && Array.isArray(b.citations)) {
      for (const c of b.citations as Array<Record<string, unknown>>) if (typeof c?.url === "string") into.add(c.url);
    } else if (type.endsWith("_tool_result")) {
      // Dynamic filtering runs search inside code execution; its output is tool output, not model text.
      const json = JSON.stringify(b.content ?? "", (k, v) => (k === "encrypted_content" ? undefined : v));
      for (const m of json.matchAll(URL_IN_TEXT)) into.add(m[0]);
    }
  }
}

type Effort = "low" | "medium" | "high";

export function createAnthropicEngine(client = new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 })): PipelineEngine {
  /** One structured-output call (no tools): schema-valid JSON or an EngineError. */
  async function structured<T>(
    schema: z.ZodType<T>,
    system: string,
    user: string,
    effort: Effort,
    maxTokens: number,
    what: string,
    signal?: AbortSignal,
  ): Promise<{ out: T; costUsd: number }> {
    let msg: Anthropic.Beta.BetaMessage;
    try {
      msg = await client.beta.messages
        .stream(
          {
            model: ANTHROPIC_MODEL,
            max_tokens: maxTokens,
            betas: BETAS,
            fallbacks: "default",
            system,
            messages: [{ role: "user", content: user }],
            output_config: { effort, format: betaZodOutputFormat(schema) },
          },
          { signal },
        )
        .finalMessage();
    } catch (e) {
      mapError(e, what);
    }
    const costUsd = anthropicCost(msg.usage);
    checkStop(msg, what);
    let parsed: unknown;
    try {
      parsed = JSON.parse(textOf(msg.content));
    } catch {
      throw Object.assign(new EngineError("invalid-output", `${what}: reply was not JSON`, true), { costUsd });
    }
    const r = schema.safeParse(parsed);
    if (!r.success) throw Object.assign(new EngineError("invalid-output", `${what}: ${r.error.issues[0]?.message ?? "schema mismatch"}`, true), { costUsd });
    return { out: r.data, costUsd };
  }

  const calls: ModelCalls = {
    name: "anthropic",
    model: ANTHROPIC_MODEL,

    async plan(query, signal) {
      try {
        return await structured(PlanOutSchema, planSystem(activeTraditions()), planUser(query), "low", 8000, "plan", signal);
      } catch (e) {
        if (e instanceof EngineError && e.code === "refused") {
          const out: PlanOut = {
            classification: "harmful",
            message: "Four Views can't help with that. Try a question about Christian belief or practice.",
            suggestion: "",
            slug: "",
            title: "",
            question: "",
            intro: "",
            traditionIds: [],
            whyTheseFour: "",
          };
          return { out, costUsd: 0 };
        }
        throw e;
      }
    },

    async view(ctx: ViewContext, signal) {
      const t = tradition(ctx.traditionId);
      const what = `${t.name} view`;
      const input = { plan: ctx.plan, tradition: t, library: ctx.library, searchDomains: ctx.searchDomains, hasSearch: true, structured: false };
      const domains = ctx.searchDomains.slice(0, 30);
      const tools: Anthropic.Beta.BetaToolUnion[] = [
        { type: "web_search_20260209", name: "web_search", max_uses: 4, ...(domains.length ? { allowed_domains: domains } : {}) },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2, max_content_tokens: 6000, ...(domains.length ? { allowed_domains: domains } : {}) },
      ];
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: viewUser(input) }];
      const seen = new Set<string>();
      let cost = 0;
      let text = "";
      let finished = false;
      for (let turn = 0; turn < 4 && !finished; turn++) {
        let msg: Anthropic.Beta.BetaMessage;
        try {
          msg = await client.beta.messages
            .stream(
              {
                model: ANTHROPIC_MODEL,
                max_tokens: 32000,
                betas: BETAS,
                fallbacks: "default",
                system: viewSystem(input),
                messages,
                tools,
                output_config: { effort: "high" },
              },
              { signal },
            )
            .finalMessage();
        } catch (e) {
          mapError(e, what);
        }
        cost += anthropicCost(msg.usage);
        collectReturnedUrls(msg.content, seen);
        text += textOf(msg.content);
        if (msg.stop_reason === "pause_turn") {
          // Server tool loop paused: send the turn back unchanged and let it resume.
          messages.push({ role: "assistant", content: msg.content });
          continue;
        }
        checkStop(msg, what);
        finished = true;
      }
      if (!finished) throw new EngineError("truncated", `${what}: search loop did not finish`, true);

      const allowed = [...seen, ...ctx.library.map((s) => s.url)];
      let problem = "";
      try {
        const r = ViewOutSchema.safeParse(extractJson(text));
        if (r.success) return { out: r.data, seenUrls: [...seen], costUsd: cost };
        problem = r.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch (e) {
        problem = e instanceof Error ? e.message : String(e);
      }
      // One repair call: same content, schema-constrained, no new facts.
      try {
        const fixed = await structured(ViewOutSchema, repairSystem(), repairUser(text, allowed, problem), "low", 16000, `${what} (repair)`, signal);
        return { out: fixed.out as ViewOut, seenUrls: [...seen], costUsd: cost + fixed.costUsd };
      } catch (e) {
        if (e instanceof EngineError) e.message += ` (first reply unusable: ${problem.slice(0, 200)}; spend so far $${cost.toFixed(3)})`;
        throw e;
      }
    },

    async synthesis(plan: OkPlan, views: View[], signal) {
      const names = Object.fromEntries(Object.values(TRADITIONS).map((t) => [t.id, t.name])) as Record<string, string>;
      return structured(
        SynthesisOutSchema,
        synthesisSystem(names, plan.traditionIds),
        synthesisUser(plan, views, names),
        "high",
        32000,
        "synthesis",
        signal,
      );
    },
  };
  return engineFrom(calls);
}
