// Perplexity engine: sonar-pro through the OpenAI SDK, search limited per tradition with
// search_domain_filter, JSON via response_format json_schema. Sources are kept only when
// their URLs came back in the response's search_results/citations or the curated library.
import OpenAI from "openai";
import { z } from "zod";
import type { View } from "../schema";
import { activeTraditions, tradition, TRADITIONS } from "../traditions";
import { EngineError } from "./errors";
import { engineFrom, type ModelCalls, type PipelineEngine, type ViewContext } from "./pipeline";
import { extractJson } from "./anthropic";
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
} from "./prompts";

export const PERPLEXITY_MODEL = "sonar-pro";
/**
 * sonar-pro list prices (from Perplexity's pricing page as last known; not re-verified 2026-11-16):
 * $3 / M input, $15 / M output, plus a request fee per 1,000 requests by search context size.
 * When the response carries usage.cost.total_cost, that figure is used instead.
 */
const PRICE = { in: 3, out: 15, requestFee: { low: 6 / 1000, medium: 10 / 1000, high: 14 / 1000 } };
const CONTEXT_SIZE = "medium" as const;
const MAX_DOMAINS = 10;

type PplxResponse = OpenAI.Chat.ChatCompletion & {
  citations?: string[];
  search_results?: Array<{ url?: string; title?: string }>;
  usage?: OpenAI.CompletionUsage & { cost?: { total_cost?: number }; search_context_size?: string };
};

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

function mapError(e: unknown, what: string): never {
  if (e instanceof EngineError) throw e;
  if (e instanceof OpenAI.APIUserAbortError) throw new EngineError("aborted", `${what}: cancelled`);
  if (e instanceof OpenAI.RateLimitError) throw new EngineError("rate-limited", `${what}: rate limited (429)`, true);
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) {
    throw new EngineError("auth", `${what}: Perplexity rejected the API key (${e.status})`);
  }
  if (e instanceof OpenAI.BadRequestError || e instanceof OpenAI.NotFoundError || e instanceof OpenAI.UnprocessableEntityError) {
    throw new EngineError("bad-request", `${what}: request rejected (${e.status}): ${e.message.slice(0, 300)}`);
  }
  if (e instanceof OpenAI.InternalServerError || e instanceof OpenAI.APIConnectionError) {
    throw new EngineError("upstream", `${what}: Perplexity unavailable`, true);
  }
  if (e instanceof OpenAI.APIError) throw new EngineError("upstream", `${what}: API error ${e.status ?? ""}`, true);
  throw new EngineError("upstream", `${what}: ${e instanceof Error ? e.message : String(e)}`, true);
}

export function perplexityCost(res: PplxResponse, searched: boolean): number {
  const reported = res.usage?.cost?.total_cost;
  if (typeof reported === "number" && Number.isFinite(reported)) return reported;
  const u = res.usage;
  const tokens = ((u?.prompt_tokens ?? 0) * PRICE.in + (u?.completion_tokens ?? 0) * PRICE.out) / 1e6;
  const size = (u?.search_context_size as keyof typeof PRICE.requestFee) ?? CONTEXT_SIZE;
  return tokens + (searched ? PRICE.requestFee[size] ?? PRICE.requestFee[CONTEXT_SIZE] : 0);
}

export function createPerplexityEngine(
  client = new OpenAI({ apiKey: process.env.PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai", maxRetries: 3, timeout: 5 * 60 * 1000 }),
): PipelineEngine {
  let searchToggleSupported = true;

  async function chat(
    what: string,
    system: string,
    user: string,
    schema: z.ZodType,
    opts: { domains?: string[]; maxTokens: number; signal?: AbortSignal },
  ): Promise<{ data: unknown; text: string; urls: string[]; costUsd: number }> {
    const search = !!opts.domains;
    const body: Record<string, unknown> = {
      model: PERPLEXITY_MODEL,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { schema: jsonSchemaOf(schema) } },
    };
    if (search) {
      if (opts.domains!.length) body.search_domain_filter = opts.domains!.slice(0, MAX_DOMAINS);
      body.web_search_options = { search_context_size: CONTEXT_SIZE };
    } else if (searchToggleSupported) {
      body.disable_search = true;
    }
    let res: PplxResponse;
    try {
      res = (await client.chat.completions.create(
        body as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        { signal: opts.signal },
      )) as PplxResponse;
    } catch (e) {
      // Older API versions may not know disable_search: retry once without it.
      if (!search && searchToggleSupported && e instanceof OpenAI.BadRequestError && /disable_search/i.test(e.message)) {
        searchToggleSupported = false;
        return chat(what, system, user, schema, opts);
      }
      mapError(e, what);
    }
    const urls = [...(res.citations ?? []), ...(res.search_results ?? []).map((r) => r.url).filter((u): u is string => !!u)];
    const costUsd = perplexityCost(res, search || urls.length > 0);
    const choice = res.choices?.[0];
    if (!choice) throw Object.assign(new EngineError("invalid-output", `${what}: empty response`, true), { costUsd });
    if (choice.message?.refusal) throw Object.assign(new EngineError("refused", `${what}: the model declined`), { costUsd });
    if (choice.finish_reason === "length") throw Object.assign(new EngineError("truncated", `${what}: output hit max_tokens`, true), { costUsd });
    const text = (choice.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    let data: unknown = undefined;
    try {
      data = extractJson(text);
    } catch {
      data = undefined;
    }
    return { data, text, urls, costUsd };
  }

  async function strict<T>(schema: z.ZodType<T>, what: string, system: string, user: string, maxTokens: number, signal?: AbortSignal) {
    const r = await chat(what, system, user, schema, { maxTokens, signal });
    const p = schema.safeParse(r.data);
    if (!p.success) throw Object.assign(new EngineError("invalid-output", `${what}: reply did not match the schema`, true), { costUsd: r.costUsd });
    return { out: p.data, costUsd: r.costUsd };
  }

  const calls: ModelCalls = {
    name: "perplexity",
    model: PERPLEXITY_MODEL,

    plan(query, signal) {
      return strict(PlanOutSchema, "plan", planSystem(activeTraditions()), planUser(query), 2000, signal);
    },

    async view(ctx: ViewContext, signal) {
      const t = tradition(ctx.traditionId);
      const what = `${t.name} view`;
      const input = { plan: ctx.plan, tradition: t, library: ctx.library, searchDomains: ctx.searchDomains.slice(0, MAX_DOMAINS), hasSearch: true, structured: true };
      const r = await chat(what, viewSystem(input), viewUser(input), ViewOutSchema, {
        domains: ctx.searchDomains,
        maxTokens: 3000,
        signal,
      });
      const p = ViewOutSchema.safeParse(r.data);
      if (p.success) return { out: p.data, seenUrls: r.urls, costUsd: r.costUsd };
      const allowed = [...r.urls, ...ctx.library.map((s) => s.url)];
      const fixed = await strict(ViewOutSchema, `${what} (repair)`, repairSystem(), repairUser(r.text, allowed, "reply did not match the schema"), 3000, signal);
      return { out: fixed.out, seenUrls: r.urls, costUsd: r.costUsd + fixed.costUsd };
    },

    synthesis(plan: OkPlan, views: View[], signal) {
      const names = Object.fromEntries(Object.values(TRADITIONS).map((t) => [t.id, t.name])) as Record<string, string>;
      return strict(SynthesisOutSchema, "synthesis", synthesisSystem(names, plan.traditionIds), synthesisUser(plan, views, names), 4000, signal);
    },
  };
  return engineFrom(calls);
}
