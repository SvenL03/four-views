// Engine entry point for the API routes.
//   getEngine(): ENGINE=mock -> mock; ANTHROPIC_API_KEY -> anthropic; PERPLEXITY_API_KEY -> perplexity; else null.
//   ENGINE=anthropic|perplexity forces that engine (null if its key is missing); ENGINE=off -> null.
import type { Engine } from "./types";
import { createAnthropicEngine } from "./anthropic";
import { createMockEngine } from "./mock";
import { createPerplexityEngine } from "./perplexity";

export type { Engine, GenerateOptions, PlanResult, Progress } from "./types";
export type { GenerateResult, ModelCalls, PipelineEngine } from "./pipeline";
export { runPlan, generateTopic, engineFrom } from "./pipeline";
export { guardQuery, normalizeQuery, type GuardResult } from "./guard";
export { validateTopic, cleanView } from "./validate";
export { EngineError, type EngineErrorCode } from "./errors";

let cached: { key: string; engine: Engine | null } | null = null;

/** The configured engine, or null when no working engine is configured (app shows "paused"). */
export function getEngine(): Engine | null {
  const forced = (process.env.ENGINE ?? "").trim().toLowerCase();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY?.trim();
  let choice: "mock" | "anthropic" | "perplexity" | null;
  if (forced === "mock") choice = "mock";
  else if (forced === "off" || forced === "none") choice = null;
  else if (forced === "anthropic") choice = hasAnthropic ? "anthropic" : null;
  else if (forced === "perplexity") choice = hasPerplexity ? "perplexity" : null;
  else choice = hasAnthropic ? "anthropic" : hasPerplexity ? "perplexity" : null;

  const key = choice ?? "none";
  if (cached?.key === key) return cached.engine;
  const engine =
    choice === "mock"
      ? createMockEngine()
      : choice === "anthropic"
        ? createAnthropicEngine()
        : choice === "perplexity"
          ? createPerplexityEngine()
          : null;
  cached = { key, engine };
  return engine;
}
