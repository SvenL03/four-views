// Post-checks shared by the pipeline and tests. Repairs what can be repaired safely
// (drops, renumbers, trims) and records each repair as a warning; throws when a topic
// cannot be made valid without inventing content.
import { TopicSchema, type Source, type Topic, type TraditionId, type View } from "../schema";
import { checkScriptureRef } from "../scripture";
import { EngineError } from "./errors";

export interface ValidateOptions {
  /**
   * URLs the model actually saw (search results, fetched pages) plus the curated library.
   * When given, a source whose URL is not in this set is dropped. Omit to skip the check.
   */
  knownUrls?: Iterable<string>;
}

const LONG_QUOTE_RE = /(["“])([^"“”]{40,}?)(["”])(\s*\(([^)]{3,40})\))?/g;
const MARKER_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g;

/** Canonical form for comparing URLs: https, no www, no hash, no tracking params, no trailing slash. */
export function normalizeUrl(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) url.searchParams.delete(k);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const p = url.pathname.replace(/\/+$/, "");
    return `${host}${p}${url.search}`;
  } catch {
    return null;
  }
}

function toKnownSet(known?: Iterable<string>): Set<string> | null {
  if (!known) return null;
  const set = new Set<string>();
  for (const u of known) {
    const n = normalizeUrl(u);
    if (n) set.add(n);
  }
  return set;
}

function wordCount(paras: string[]): number {
  return paras.join(" ").split(/\s+/).filter(Boolean).length;
}

function expandMarker(inner: string): number[] {
  const out: number[] = [];
  for (const part of inner.split(/\s*,\s*/)) {
    const range = part.split(/\s*[–-]\s*/).map(Number);
    if (range.length === 2 && range[1] >= range[0] && range[1] - range[0] < 10) {
      for (let k = range[0]; k <= range[1]; k++) out.push(k);
    } else out.push(Number(range[0]));
  }
  return out;
}

/** Remove sentences that carry a long non-Scripture quotation (paraphrase-only policy). */
function stripLongQuotes(paras: string[], label: string, warnings: string[]): string[] {
  const TRAIL = /^(?:\s*\[\d+(?:\s*[,–-]\s*\d+)*\])*/;
  const out: string[] = [];
  for (const para of paras) {
    let p = para;
    for (let guard = 0; guard < 10; guard++) {
      let hit: RegExpMatchArray | null = null;
      for (const m of p.matchAll(LONG_QUOTE_RE)) {
        const ref = m[5];
        if (ref && checkScriptureRef(ref.replace(/^(cf\.|see)\s+/i, "").trim()) === null) continue; // Scripture with its reference
        hit = m;
        break;
      }
      if (!hit || hit.index === undefined) break;
      const qs = hit.index;
      const qe = qs + hit[0].length;
      // Sentence start: just after the last sentence end before the quote.
      const startMatch = p.slice(0, qs).match(/^[\s\S]*[.!?]["”')\]]*(?:\[\d+(?:\s*[,–-]\s*\d+)*\])*\s+/);
      const start = startMatch ? startMatch[0].length : 0;
      // Sentence end: the quote itself if it closes the sentence, else the next sentence end.
      const after = p.slice(qe);
      const closesSentence = !hit[4] && /[.!?]$/.test(hit[2].trim());
      const endMatch = closesSentence
        ? after.match(TRAIL)
        : after.match(/^[^.!?]*[.!?]+["”')\]]*(?:\s*\[\d+(?:\s*[,–-]\s*\d+)*\])*/);
      const end = endMatch ? qe + endMatch[0].length : p.length;
      p = (p.slice(0, start) + p.slice(end)).replace(/\s+/g, " ").trim();
      warnings.push(`${label}: removed a sentence with a long quotation (paraphrase only)`);
    }
    if (p) out.push(p);
  }
  return out;
}

/**
 * Clean one view: long quotes out, unknown/duplicate/uncited sources dropped,
 * markers renumbered to first-appearance order, bad Scripture refs dropped.
 */
export function cleanView(view: View, opts: ValidateOptions = {}): { view: View; warnings: string[] } {
  const warnings: string[] = [];
  const label = view.traditionId;
  const known = toKnownSet(opts.knownUrls);

  let body = stripLongQuotes(view.body.map((p) => p.trim()).filter(Boolean), label, warnings);

  // Which original sources are acceptable? Map original 1-based index -> canonical key.
  const keyOf = new Map<number, string>();
  const firstSourceForKey = new Map<string, Source>();
  view.sources.forEach((s, i) => {
    const n = normalizeUrl(s.url);
    if (!n) {
      warnings.push(`${label}: dropped source "${s.title}" (invalid URL)`);
      return;
    }
    if (known && !known.has(n)) {
      warnings.push(`${label}: dropped source "${s.title}" (${s.url} was not returned by search or the library)`);
      return;
    }
    keyOf.set(i + 1, n);
    if (!firstSourceForKey.has(n)) firstSourceForKey.set(n, s);
  });

  // Renumber markers by first appearance in the body; drop markers to dropped/out-of-range sources.
  const newIndex = new Map<string, number>();
  const ordered: Source[] = [];
  let droppedMarkers = 0;
  body = body.map((p) =>
    p
      .replace(MARKER_RE, (_m, inner: string) => {
        const nums: number[] = [];
        for (const k of expandMarker(inner)) {
          const key = keyOf.get(k);
          if (!key) {
            droppedMarkers++;
            continue;
          }
          if (!newIndex.has(key)) {
            if (ordered.length >= 8) {
              droppedMarkers++;
              continue;
            }
            ordered.push(firstSourceForKey.get(key)!);
            newIndex.set(key, ordered.length);
          }
          const n = newIndex.get(key)!;
          if (!nums.includes(n)) nums.push(n);
        }
        return nums.map((n) => `[${n}]`).join("");
      })
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
  if (droppedMarkers) warnings.push(`${label}: removed ${droppedMarkers} citation marker(s) pointing at no valid source`);
  const uncited = new Set([...keyOf.values()].filter((k) => !newIndex.has(k)));
  if (uncited.size) warnings.push(`${label}: dropped ${uncited.size} source(s) never cited in the body`);

  if (body.length > 5) {
    warnings.push(`${label}: body had ${body.length} paragraphs; kept 5`);
    body = body.slice(0, 5);
  }
  const words = wordCount(body);
  if (words < 120 || words > 340) warnings.push(`${label}: body is ${words} words (target 180-260)`);

  const keyTexts = view.keyTexts.filter((kt) => {
    const err = checkScriptureRef(kt.ref);
    if (err) warnings.push(`${label}: dropped Scripture "${kt.ref}" (${err})`);
    return !err;
  });
  if (keyTexts.length > 6) warnings.push(`${label}: kept 6 of ${keyTexts.length} key texts`);

  let consensusNote = view.consensusNote?.trim() || undefined;
  if (view.consensus === "no-official-position" && !consensusNote) {
    consensusNote = "This tradition has no single official statement on this question.";
    warnings.push(`${label}: added a generic consensusNote for no-official-position`);
  }
  if (view.consensus === "divided" && !consensusNote) warnings.push(`${label}: consensus is divided but no consensusNote`);

  return {
    view: {
      ...view,
      headline: view.headline.trim(),
      body,
      keyTexts: keyTexts.slice(0, 6),
      sources: ordered.map((s, i) => ({ ...s, id: s.id?.trim() || `s${i + 1}` })),
      consensusNote,
    },
    warnings,
  };
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 6)
      .join("-") || "topic"
  );
}

/**
 * Validate and repair a whole topic. Returns the parsed Topic and warnings,
 * or throws EngineError("invalid-topic") listing what could not be repaired.
 */
export function validateTopic(input: Topic, opts: ValidateOptions = {}): { topic: Topic; warnings: string[] } {
  const warnings: string[] = [];
  const problems: string[] = [];
  const ids = [...input.traditionIds] as TraditionId[];
  if (ids.length !== 4 || new Set(ids).size !== 4) problems.push("traditionIds must be 4 distinct ids");

  // Views: same order as traditionIds, each cleaned.
  const views: View[] = [];
  for (const id of ids) {
    const v = input.views.find((x) => x.traditionId === id);
    if (!v) {
      problems.push(`missing view for ${id}`);
      continue;
    }
    const cleaned = cleanView(v, opts);
    warnings.push(...cleaned.warnings);
    if (!cleaned.view.sources.length) problems.push(`${id}: no valid, cited source left`);
    if (!cleaned.view.body.length) problems.push(`${id}: empty body`);
    views.push(cleaned.view);
  }

  // Synthesis.
  const idSet = new Set<string>(ids);
  const known = toKnownSet(opts.knownUrls);
  for (const v of views) for (const s of v.sources) known?.add(normalizeUrl(s.url)!);
  const syn = input.synthesis;
  const common = syn.common.map((c) => c.trim()).filter(Boolean);
  if (common.length > 6) warnings.push(`synthesis: kept 6 of ${common.length} common points`);

  const partings = syn.partings
    .map((p) => {
      const seen = new Set<string>();
      const answers = p.answers.filter((a) => idSet.has(a.traditionId) && a.answer.trim() && !seen.has(a.traditionId) && seen.add(a.traditionId));
      return { ...p, answers: ids.map((id) => answers.find((a) => a.traditionId === id)).filter((a) => !!a) };
    })
    .filter((p) => {
      if (p.answers.length === 4) return true;
      warnings.push(`synthesis: dropped parting "${p.question}" (answered by ${p.answers.length} of 4)`);
      return false;
    });
  if (!partings.length) problems.push("synthesis: no parting answered by all four traditions");
  if (partings.length > 6) warnings.push(`synthesis: kept 6 of ${partings.length} partings`);

  const terms = syn.terms
    .map((t) => ({ ...t, meanings: t.meanings.filter((m) => idSet.has(m.traditionId) && m.meaning.trim()) }))
    .filter((t) => {
      if (t.meanings.length >= 2) return true;
      warnings.push(`synthesis: dropped term "${t.term}" (fewer than two meanings from this topic's traditions)`);
      return false;
    });

  const furtherReading = syn.furtherReading.map((r) => {
    const item = { ...r, traditionIds: r.traditionIds.filter((id) => idSet.has(id)) };
    if (item.url) {
      const n = normalizeUrl(item.url);
      if (!n || (known && !known.has(n))) {
        warnings.push(`synthesis: removed unverified URL from further reading "${r.title}"`);
        delete item.url;
      }
    }
    return item;
  });

  let slug = input.slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    slug = slugify(slug || input.title);
    warnings.push(`slug rewritten to "${slug}"`);
  }

  if (problems.length) throw new EngineError("invalid-topic", `Topic could not be validated: ${problems.join("; ")}`);

  const candidate: Topic = {
    ...input,
    slug,
    traditionIds: ids,
    views,
    synthesis: {
      common: common.slice(0, 6),
      partings: partings.slice(0, 6),
      terms: terms.slice(0, 5),
      furtherReading: furtherReading.slice(0, 10),
    },
  };
  const parsed = TopicSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new EngineError(
      "invalid-topic",
      `Topic failed the schema: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return { topic: parsed.data, warnings };
}
