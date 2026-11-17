// Deterministic mock engine (ENGINE=mock): a valid Topic for any query, no network, no cost.
// For tests and local UI work only; its text is placeholder, not theology.
import type { TraditionId, View } from "../schema";
import { activeTraditions, tradition } from "../traditions";
import { normalizeQuery } from "./guard";
import { engineFrom, type ModelCalls, type PipelineEngine, type ViewContext } from "./pipeline";
import type { OkPlan, PlanOut, SynthesisOut, ViewOut } from "./prompts";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const KEY_TEXTS = ["Romans 6:3-4", "Matthew 28:19-20", "John 3:16", "Ephesians 2:8-9", "Acts 2:38-39", "1 Corinthians 11:23-26", "Hebrews 11:1", "James 2:17"];

function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function mockCalls(): ModelCalls {
  return {
    name: "mock",
    model: "mock-1",
    async plan(query) {
      const key = normalizeQuery(query);
      const empty = { slug: "", title: "", question: "", intro: "", traditionIds: [], whyTheseFour: "", suggestion: "", message: "" };
      if (/\b(evil|stupid|idiots?|morons?|cult(ists)?|brainwashed)\b/i.test(query)) {
        return {
          out: { ...empty, classification: "bad-faith", message: "Four Views presents each tradition in its own best terms.", suggestion: "How do Reformed Christians understand God's sovereignty in salvation?" },
          costUsd: 0,
        } satisfies { out: PlanOut; costUsd: number };
      }
      if (/\b(recipe|pizza|football|stock market|weather|javascript)\b/i.test(query)) {
        return { out: { ...empty, classification: "off-topic", message: "Four Views compares Christian traditions on theological questions." }, costUsd: 0 };
      }
      if (key.split(" ").length === 1 && ["god", "religion", "church", "stuff", "faith"].includes(key)) {
        return { out: { ...empty, classification: "too-vague", message: "That's a bit broad to compare fairly.", suggestion: "How do Christians understand the Trinity?" }, costUsd: 0 };
      }
      const active = activeTraditions().map((t) => t.id);
      const ids: TraditionId[] = [];
      let h = hash(key);
      while (ids.length < 4) {
        const id = active[h % active.length];
        if (!ids.includes(id)) ids.push(id);
        h = Math.imul(h, 2654435761) >>> 0 || 1;
        h = (h + 7) >>> 0;
      }
      const title = titleCase(key).slice(0, 60) || "Topic";
      return {
        out: {
          classification: "ok",
          message: "",
          suggestion: "",
          slug: key,
          title,
          question: `What do Christian traditions teach about ${key}?`,
          intro: `Christians agree that ${key} matters, but they explain it differently. This page sets four traditions side by side, each in its own words.`,
          traditionIds: ids,
          whyTheseFour: "Mock selection: four distinct traditions chosen deterministically from the query.",
        },
        costUsd: 0,
      };
    },
    async view(ctx: ViewContext) {
      const t = tradition(ctx.traditionId);
      const lib = ctx.library.length
        ? ctx.library.slice(0, 2).map((s) => ({ title: s.title, url: s.url, kind: s.kind, ...(s.publisher ? { publisher: s.publisher } : {}) }))
        : ctx.searchDomains.slice(0, 2).map((d, i) => ({
            title: `${t.bodies[i] ?? t.name} (official site)`,
            url: `https://${d}/`,
            kind: "web" as const,
            publisher: t.bodies[i] ?? t.name,
          }));
      const seenUrls = lib.map((s) => s.url);
      const filler = "This is mock text so the interface has something of realistic length to lay out while no model is connected.";
      const p1 = `${t.name} Christians approach ${ctx.plan.title.toLowerCase()} from their emphasis on ${t.emphases[0].toLowerCase()} [1]. ${filler} ${filler}`;
      const p2 = `The tradition also stresses ${t.emphases[1].toLowerCase()} and ${t.emphases[2].toLowerCase()}${lib.length > 1 ? " [2]" : " [1]"}. ${filler} ${filler} ${filler}`;
      const p3 = `${t.diversity} ${filler} ${filler}`;
      const h = hash(ctx.traditionId + ctx.plan.slug);
      const out: ViewOut = {
        headline: `${t.name} Christians read ${ctx.plan.title.toLowerCase()} through ${t.emphases[0].toLowerCase()}.`,
        body: [p1, p2, p3],
        keyTexts: [0, 1, 2].map((k) => ({ ref: KEY_TEXTS[(h + k) % KEY_TEXTS.length], why: "Mock: a passage this tradition often cites." })),
        sources: lib,
        consensus: (["settled", "mostly", "divided"] as const)[h % 3],
        consensusNote: h % 3 === 0 ? undefined : `Mock: ${t.diversity}`,
      };
      return { out, seenUrls, costUsd: 0 };
    },
    async synthesis(plan: OkPlan, views: View[]) {
      const ids = plan.traditionIds;
      const out: SynthesisOut = {
        common: ["All four confess the authority of Scripture.", "All four call the question important for Christian life."],
        partings: [
          {
            question: `What does ${plan.title.toLowerCase()} accomplish?`,
            why: "Mock: the traditions weigh grace, faith and the church differently.",
            answers: ids.map((id) => ({ traditionId: id, answer: `${tradition(id).name}: ${views.find((v) => v.traditionId === id)?.headline ?? ""}` })),
          },
          {
            question: "Who has the final word on the question?",
            why: "Mock: different views of authority.",
            answers: ids.map((id) => ({ traditionId: id, answer: `${tradition(id).short} answer (mock).` })),
          },
        ],
        terms: [{ term: "grace", meanings: ids.slice(0, 2).map((id) => ({ traditionId: id, meaning: `How ${tradition(id).short} uses the word (mock).` })) }],
        furtherReading: views.map((v) => ({
          title: v.sources[0].title,
          author: v.sources[0].publisher ?? tradition(v.traditionId).name,
          url: v.sources[0].url,
          note: "Mock: the tradition's own statement.",
          traditionIds: [v.traditionId],
        })),
      };
      return { out, costUsd: 0 };
    },
  };
}

export function createMockEngine(): PipelineEngine {
  return engineFrom(mockCalls());
}
