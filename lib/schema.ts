// Shared contract for Four Views v2. Every part of the app (engine, cache,
// pages, seed content) reads and writes topics in exactly this shape.
import { z } from "zod";

export const TRADITION_IDS = [
  "reformed",
  "arminian",
  "fundamentalist",
  "conservative_evangelical",
  "progressive_evangelical",
  "mainline_liberal",
  "charismatic",
  "word_of_faith",
  "dispensationalist",
  "open_theist",
  // Candidates (off unless EXTRA_TRADITIONS=1; decision for Sven)
  "lutheran",
  "roman_catholic",
  "eastern_orthodox",
] as const;

export const TraditionIdSchema = z.enum(TRADITION_IDS);
export type TraditionId = z.infer<typeof TraditionIdSchema>;

/** A document or page a view relies on. Every url must open. */
export const SourceSchema = z.object({
  /** Stable id within the view, e.g. "wcf". Inline markers in prose use the 1-based index: [1]. */
  id: z.string(),
  title: z.string(),
  author: z.string().optional(),
  /** Who publishes or hosts it, e.g. "Orthodox Presbyterian Church". */
  publisher: z.string().optional(),
  year: z.number().int().nullable().optional(),
  url: z.string().url(),
  kind: z.enum([
    "creed",
    "confession",
    "catechism",
    "statement", // official denominational statement or position paper
    "book",
    "article",
    "sermon",
    "web",
  ]),
  /** Pinpoint inside the source, e.g. "ch. 28.4", "Q&A 74", "Article 7". */
  locator: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ViewSchema = z.object({
  traditionId: TraditionIdSchema,
  /** One sentence: the position as a thoughtful adherent would put it. */
  headline: z.string(),
  /**
   * 2-4 short paragraphs in plain language, in the tradition's own vocabulary,
   * at its strongest. Paraphrase only (no quotation marks around anything but
   * Scripture). Cite with [n] = 1-based index into `sources`.
   */
  body: z.array(z.string()).min(1).max(5),
  /** Scripture passages this tradition leans on, with why. */
  keyTexts: z
    .array(z.object({ ref: z.string(), why: z.string() }))
    .max(6),
  sources: z.array(SourceSchema).min(1).max(8),
  /** Is this tradition settled on the question? */
  consensus: z.enum(["settled", "mostly", "divided", "no-official-position"]),
  /** Who inside the tradition disagrees, or why there is no official position. */
  consensusNote: z.string().optional(),
});
export type View = z.infer<typeof ViewSchema>;

export const TraditionAnswerSchema = z.object({
  traditionId: TraditionIdSchema,
  answer: z.string(),
});

export const SynthesisSchema = z.object({
  /** Where all four agree. */
  common: z.array(z.string()).max(6),
  /** The precise questions where they part ways, each answered by all four. */
  partings: z
    .array(
      z.object({
        question: z.string(),
        /** Why this is the hinge (the underlying principle that drives the split). */
        why: z.string(),
        answers: z.array(TraditionAnswerSchema),
      }),
    )
    .min(1)
    .max(6),
  /** Words the traditions all use but mean differently. */
  terms: z
    .array(
      z.object({
        term: z.string(),
        meanings: z.array(
          z.object({ traditionId: TraditionIdSchema, meaning: z.string() }),
        ),
      }),
    )
    .max(5),
  /** Where to read more: each tradition's own best case, plus multi-view books. */
  furtherReading: z
    .array(
      z.object({
        title: z.string(),
        author: z.string(),
        url: z.string().url().optional(),
        note: z.string(),
        traditionIds: z.array(TraditionIdSchema),
      }),
    )
    .max(10),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

export const TopicMetaSchema = z.object({
  version: z.literal(2),
  generatedAt: z.string(),
  engine: z.string(), // "seed:claude-code", "anthropic", "perplexity", ...
  model: z.string().optional(),
  costUsd: z.number().optional(),
  /** True when a person checked a sample of the citations by opening them. */
  reviewed: z.boolean(),
  reviewNotes: z.string().optional(),
});

export const TopicSchema = z.object({
  /** URL slug, lowercase-kebab, e.g. "baptism". */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Short display title, e.g. "Baptism". */
  title: z.string(),
  /** The neutral question being compared, e.g. "Who should be baptized, how, and what does baptism do?" */
  question: z.string(),
  /** 2-3 sentences framing the question for a non-seminarian. No side taken. */
  intro: z.string(),
  traditionIds: z.array(TraditionIdSchema).length(4),
  /** One or two sentences: why these four views were chosen for this topic. */
  whyTheseFour: z.string(),
  views: z.array(ViewSchema).length(4),
  synthesis: SynthesisSchema,
  meta: TopicMetaSchema,
});
export type Topic = z.infer<typeof TopicSchema>;

/** Light summary used by lists, the sitemap and OG images. */
export type TopicSummary = Pick<Topic, "slug" | "title" | "question" | "traditionIds"> & {
  generatedAt: string;
};

export function scriptureUrl(ref: string, version: string): string {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(version)}`;
}
