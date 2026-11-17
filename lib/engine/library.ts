// Per-tradition source library and search domains.
// Prefers data/traditions.research.json (a verified library another helper builds);
// degrades to a small built-in list of each tradition's own official sites.
import fs from "node:fs";
import path from "node:path";
import { SourceSchema, TRADITION_IDS, type Source, type TraditionId } from "../schema";

export interface TraditionLibrary {
  /** Hostnames the web search may use for this tradition (subdomains included). */
  searchDomains: string[];
  /** Curated, verified sources. A view may cite these without a search hit. */
  sources: Source[];
  /** "research" when data/traditions.research.json supplied it, else "default". */
  origin: "research" | "default";
}

/** Each tradition's own bodies, schools and publishers. Used only when the research file is absent. */
export const DEFAULT_SEARCH_DOMAINS: Record<TraditionId, string[]> = {
  reformed: ["opc.org", "pcaac.org", "crcna.org", "wts.edu", "ligonier.org", "ccel.org", "arbca.com"],
  arminian: ["nazarene.org", "wesleyan.org", "fmcusa.org", "globalmethodist.org", "nafwb.org", "seedbed.com"],
  fundamentalist: ["garbc.org", "ifca.org", "fbfi.org", "bju.edu", "dbts.edu"],
  conservative_evangelical: ["sbc.net", "efca.org", "nae.org", "thegospelcoalition.org", "sbts.edu", "erlc.com"],
  progressive_evangelical: [
    "sojo.net",
    "christiansforsocialaction.org",
    "redletterchristians.org",
    "cbeinternational.org",
    "missioalliance.org",
  ],
  mainline_liberal: ["pcusa.org", "episcopalchurch.org", "umc.org", "ucc.org", "elca.org"],
  charismatic: ["ag.org", "foursquare.org", "churchofgod.org", "cogic.org", "oru.edu"],
  word_of_faith: ["rhema.org", "kcm.org", "awmi.net"],
  dispensationalist: ["dts.edu", "tms.edu", "moody.edu", "bible.org", "gty.org", "pre-trib.org"],
  open_theist: ["reknew.org", "whchurch.org"],
  lutheran: ["lcms.org", "wels.net", "thenalc.org", "bookofconcord.org", "cph.org"],
  roman_catholic: ["vatican.va", "usccb.org"],
  eastern_orthodox: ["goarch.org", "oca.org", "antiochian.org"],
};

const KINDS = SourceSchema.shape.kind.options as readonly string[];
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function cleanDomain(d: unknown): string | null {
  if (typeof d !== "string") return null;
  let h = d.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(h)) h = new URL(h).hostname;
  } catch {
    return null;
  }
  h = h.replace(/^www\./, "").replace(/\/.*$/, "");
  return HOST_RE.test(h) ? h : null;
}

function cleanSource(raw: unknown, i: number): Source | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = typeof r.kind === "string" && KINDS.includes(r.kind) ? r.kind : "web";
  const candidate = {
    id: typeof r.id === "string" && r.id ? r.id : `lib${i + 1}`,
    title: r.title,
    author: typeof r.author === "string" ? r.author : undefined,
    publisher: typeof r.publisher === "string" ? r.publisher : undefined,
    year: typeof r.year === "number" && Number.isInteger(r.year) ? r.year : undefined,
    url: r.url,
    kind,
    locator: typeof r.locator === "string" ? r.locator : undefined,
  };
  const parsed = SourceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

type ResearchEntry = { searchDomains: string[]; sources: Source[] };
let cache: Map<TraditionId, ResearchEntry> | null | undefined;

/** Reads data/traditions.research.json once. Accepts {traditions:{id:{...}}}, {id:{...}} or [{traditionId|id,...}]. */
function loadResearch(): Map<TraditionId, ResearchEntry> | null {
  if (cache !== undefined) return cache;
  cache = null;
  try {
    const json: unknown = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "traditions.research.json"), "utf8"));
    let entries: [string, unknown][] = [];
    const root = json && typeof json === "object" && "traditions" in json ? (json as { traditions: unknown }).traditions : json;
    if (Array.isArray(root)) {
      entries = root.map((e) => [String((e as Record<string, unknown>)?.traditionId ?? (e as Record<string, unknown>)?.id ?? ""), e]);
    } else if (root && typeof root === "object") {
      entries = Object.entries(root as Record<string, unknown>);
    }
    const map = new Map<TraditionId, ResearchEntry>();
    for (const [id, e] of entries) {
      if (!(TRADITION_IDS as readonly string[]).includes(id) || !e || typeof e !== "object") continue;
      const r = e as Record<string, unknown>;
      const domains = (Array.isArray(r.searchDomains) ? r.searchDomains : []).map(cleanDomain).filter((d): d is string => !!d);
      const sources = (Array.isArray(r.sources) ? r.sources : []).map(cleanSource).filter((s): s is Source => !!s);
      map.set(id as TraditionId, { searchDomains: [...new Set(domains)], sources });
    }
    cache = map.size ? map : null;
  } catch {
    cache = null; // absent or unreadable: fall back to defaults
  }
  return cache;
}

/** For tests: forget the cached research file. */
export function resetLibraryCache(): void {
  cache = undefined;
}

export function getLibrary(id: TraditionId): TraditionLibrary {
  const research = loadResearch()?.get(id);
  const sources = research?.sources ?? [];
  const domains = new Set<string>(research?.searchDomains.length ? research.searchDomains : DEFAULT_SEARCH_DOMAINS[id]);
  // Curated sources must be fetchable too.
  for (const s of sources) {
    const d = cleanDomain(s.url);
    if (d) domains.add(d);
  }
  return {
    searchDomains: [...domains].slice(0, 30),
    sources: sources.slice(0, 15),
    origin: research ? "research" : "default",
  };
}
