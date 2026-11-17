# Four Views

Type a theological question and see it through four American Christian traditions side by side: each stated the way its own adherents would state it, sourced from that tradition's own confessions, catechisms and official statements, with where they agree, where exactly they part ways and why, the words they use differently, and where to read more.

It's a summary to start from. The sources are the authority.

## How it works

1. **Plan.** The reader's question is checked (length, no links or code, off-topic and bad-faith questions get a friendly reply and, where possible, a neutral rephrasing). The model picks the four traditions that differ most illuminatingly on *that* question and says why.
2. **Four views, in parallel.** One call per tradition, each with web search limited to that tradition's own institutions and publishers, plus a curated list of its primary documents. Third person, same length and register for all four, paraphrase only (no quotation marks around document text), citations as `[n]` pointing at real URLs.
3. **Synthesis.** Common ground, the precise questions where they part ways (answered by all four), terms used differently, further reading.
4. **Validation.** Schema check; citation markers in range; a source is kept only if its URL came back from search or is in the curated library; Scripture references checked against the canon; long quotations stripped.
5. **Cache.** Topics are stored in Neon (Postgres). The second reader of a topic costs nothing, and two readers asking the same new topic at once pay once.

Seeded topics (`data/topics/*.json`) were written and source-checked by hand-supervised runs; every link is machine-checked by `scripts/check-topics.ts` and a sample of locators was opened and checked per topic (see each file's `meta.reviewNotes`).

### The traditions

Ten traditions (Sven's pool), described the way their adherents would put it: Reformed, Wesleyan-Arminian, Independent Fundamentalist, Conservative Evangelical, Progressive Evangelical, Mainline Protestant, Pentecostal-Charismatic, Word of Faith, Dispensationalist, Open Theism. Lutheran, Roman Catholic and Eastern Orthodox profiles exist and are off unless `EXTRA_TRADITIONS=1`. Profiles live in `lib/traditions.ts`.

## Code map

| Path | What |
|---|---|
| `lib/schema.ts` | The topic shape (zod). Everything reads and writes this. |
| `lib/traditions.ts` | Tradition profiles: self-description, bodies, internal diversity, Bible translation, accent hue. |
| `lib/engine/` | Prompts, pipeline, validation, input guard, and the engines (`anthropic`, `perplexity`, `mock`). |
| `lib/topics.ts`, `lib/db.ts` | Topic store: Neon first, seed files as fallback. |
| `lib/limits.ts` | Per-visitor rate limits (hashed, never raw IPs) and the daily spend cap. |
| `app/api/topics` | `POST` create/lookup a topic, `GET ?q=` search; `GET /api/topics/[slug]` status and content. Shapes in `lib/api-contract.ts`. |
| `app/t/[slug]` | Topic page, its preview image, metadata. |
| `scripts/` | `check-topics.ts` (topic checker), `db-migrate.ts`, `db-seed.ts`, `engine-smoke.ts`. |

## Run it locally

```bash
npm install
```

```bash
ENGINE=mock npm run dev
```

`ENGINE=mock` writes fake topics so you can click through the whole flow without a key. Without `ENGINE` and without a key, new topics show the "paused" state and the seeded topics still work.

Check the seeded topics (schema, markers, Scripture, and that every link opens):

```bash
node scripts/check-topics.ts
```

## Environment

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Claude engine (preferred when set) |
| `PERPLEXITY_API_KEY` | Perplexity engine (used when no Anthropic key) |
| `ENGINE` | `mock` for local testing |
| `DATABASE_URL` | Neon cache, limits and spend tracking (added by the Vercel Neon integration) |
| `DAILY_SPEND_CAP_USD` | Daily cap on model spend, default 2 |
| `DAILY_GENERATION_CAP` | Daily cap on new topics, default 25 |
| `RATE_LIMIT_SECRET` | Salt for hashing visitor keys |
| `EXTRA_TRADITIONS` | `1` to add Lutheran, Roman Catholic, Eastern Orthodox |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for links and preview images |

Keys live only in Vercel env vars and `.env.local` (git-ignored). Nothing reaches the browser.

## Database

```bash
node scripts/db-migrate.ts
```

```bash
node scripts/db-seed.ts
```

## Deploy

The Vercel project is `four-views` (team Sven Pro Services). Pushing a branch makes a private preview. Production deploys from `main`.

```bash
vercel deploy
```
