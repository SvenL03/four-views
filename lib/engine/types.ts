// Engine contract. An engine turns a reader's query into a checked Topic.
// The pipeline (lib/engine/pipeline.ts) owns prompts and validation; engines
// (anthropic.ts, perplexity.ts) only make model calls.
import type { Topic, TraditionId } from "../schema";

export type PlanResult =
  | {
      kind: "ok";
      slug: string;
      title: string;
      question: string;
      intro: string;
      traditionIds: TraditionId[]; // exactly 4
      whyTheseFour: string;
    }
  | {
      kind: "rejected";
      reason: "off-topic" | "bad-faith" | "harmful" | "too-vague";
      /** Friendly message shown to the reader. */
      message: string;
      /** A neutral, answerable rephrasing, when one exists. */
      suggestion?: string;
    };

export interface Progress {
  stage: "plan" | "views" | "synthesis" | "done";
  viewsDone: number;
  /** Partial topic so far (views filled in as they finish). */
  partial?: Partial<Topic>;
}

export interface GenerateOptions {
  onProgress?: (p: Progress) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface Engine {
  name: string; // "anthropic" | "perplexity" | "mock"
  model: string;
  plan(query: string): Promise<{ result: PlanResult; costUsd: number }>;
  generate(
    plan: Extract<PlanResult, { kind: "ok" }>,
    opts?: GenerateOptions,
  ): Promise<{ topic: Topic; costUsd: number }>;
}
