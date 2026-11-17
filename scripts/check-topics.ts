// Checks seeded topics: schema, internal consistency, Scripture references,
// inline citation markers, quotation policy, and that every source URL opens.
// Usage: node scripts/check-topics.ts [slug ...] [--no-net]
import fs from "node:fs";
import path from "node:path";
import { TopicSchema, type Topic } from "../lib/schema.ts";
import { checkScriptureRef } from "../lib/scripture.ts";

const args = process.argv.slice(2);
const noNet = args.includes("--no-net");
const slugs = args.filter((a) => !a.startsWith("--"));
const dir = path.join(process.cwd(), "data", "topics");
const files = slugs.length
  ? slugs.map((s) => path.join(dir, `${s}.json`))
  : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));

async function urlOpens(url: string): Promise<string | null> {
  const headers = { "user-agent": "Mozilla/5.0 (FourViews link check)" };
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", headers, signal: AbortSignal.timeout(15000) });
    if (res.status >= 400) {
      res = await fetch(url, { method: "GET", redirect: "follow", headers, signal: AbortSignal.timeout(20000) });
    }
    return res.status < 400 ? null : `HTTP ${res.status}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

let failed = 0;
for (const file of files) {
  const problems: string[] = [];
  const warnings: string[] = [];
  let topic: Topic;
  try {
    topic = TopicSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (e) {
    console.log(`✗ ${path.basename(file)}: schema\n${e instanceof Error ? e.message : e}`);
    failed++;
    continue;
  }
  if (`${topic.slug}.json` !== path.basename(file)) problems.push(`slug ${topic.slug} does not match file name`);
  const ids = topic.traditionIds;
  if (new Set(ids).size !== 4) problems.push("traditionIds must be 4 distinct ids");
  topic.views.forEach((v, i) => {
    if (v.traditionId !== ids[i]) problems.push(`views[${i}] is ${v.traditionId}, expected ${ids[i]} (same order as traditionIds)`);
    const n = v.sources.length;
    const text = v.body.join("\n");
    for (const m of text.matchAll(/\[(\d+)\]/g)) {
      const k = Number(m[1]);
      if (k < 1 || k > n) problems.push(`${v.traditionId}: marker [${k}] but only ${n} sources`);
    }
    const used = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    v.sources.forEach((_, j) => {
      if (!used.has(j + 1)) warnings.push(`${v.traditionId}: source [${j + 1}] is never cited in the body`);
    });
    if (/[“"][^”"]{40,}[”"]/.test(text)) problems.push(`${v.traditionId}: long quotation in body (paraphrase instead)`);
    for (const kt of v.keyTexts) {
      const err = checkScriptureRef(kt.ref);
      if (err) problems.push(`${v.traditionId}: Scripture "${kt.ref}": ${err}`);
    }
    if ((v.consensus === "divided" || v.consensus === "no-official-position") && !v.consensusNote)
      problems.push(`${v.traditionId}: consensus=${v.consensus} needs consensusNote`);
  });
  for (const p of topic.synthesis.partings) {
    const got = p.answers.map((a) => a.traditionId).sort().join();
    if (got !== [...ids].sort().join()) problems.push(`parting "${p.question}" must answer for all four traditions`);
  }
  for (const t of topic.synthesis.terms) {
    for (const m of t.meanings) if (!ids.includes(m.traditionId)) problems.push(`term "${t.term}" names ${m.traditionId}, not in this topic`);
  }
  if (!noNet) {
    const urls = new Set<string>();
    topic.views.forEach((v) => v.sources.forEach((s) => urls.add(s.url)));
    topic.synthesis.furtherReading.forEach((r) => r.url && urls.add(r.url));
    const results = await Promise.all([...urls].map(async (u) => [u, await urlOpens(u)] as const));
    for (const [u, err] of results) if (err) problems.push(`link does not open: ${u} (${err})`);
  }
  if (problems.length) {
    failed++;
    console.log(`✗ ${topic.slug}`);
    problems.forEach((p) => console.log(`   - ${p}`));
  } else {
    console.log(`✓ ${topic.slug}`);
  }
  warnings.forEach((w) => console.log(`   ~ ${w}`));
}
process.exit(failed ? 1 : 0);
