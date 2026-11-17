# Four Views rework (Nov 2026)

## Status (keep current)

- **Updated:** 2026-11-16 7:35 PM ET
- **Branch:** `rework-2026-11` (pushed). Production (`four-views.vercel.app`, from `main`) is untouched.
- **Done and committed:** the six test topics (all pass `scripts/check-topics.ts`, every source opened by the writer, 6 more citations re-opened by the integrator); engine (Claude + Perplexity adapters, validation, guard, mock; 19 smoke checks pass); Neon database (free plan, tables made), per-visitor limits, daily spend cap, topics API, share images, sitemap. Build passes; an early private preview deployed and its API behaves (ready / paused / rejected / missing / search / OG image / sitemap).
- **Now:** UI helper finishing the comparison layout; then deploy, walk at desktop and phone width, write `READY-FOR-REVIEW.md`.
- **Engine:** no working key. Both Perplexity keys are dead and Vercel AI Gateway needs a card on file. The app works without one (checked, pre-written topics; new topics show a friendly "paused" state). Decision packaged in `DECISIONS-FOR-SVEN.md`.
- **Pick up from here:** contract is `lib/schema.ts` (topic shape), `lib/traditions.ts`, `lib/engine/types.ts`, `lib/api-contract.ts`. Check topics with `node scripts/check-topics.ts`.

## 1. Audit of the live site (Nov 16, 2026, ~7:05 PM ET)

### It doesn't work at all
- Every query fails. Typing "baptism" shows a red card: "Failed to select traditions". `GET /api/select-traditions` and `POST /api/views` both return HTTP 500.
- Cause: the production Perplexity key is rejected as invalid (401 `invalid_api_key`); the key in `.env.local` is a different key with no credits left (401 `insufficient_quota`). Preview deployments have no key at all (the env var is set for Production only), so a preview could never have worked.
- The API routes have no error handling, so a provider failure becomes a bare 500 and a generic message.
- Because nothing generates, the six test topics (baptism, the Lord's Supper, predestination and free will, women in ministry, the end times, and the unusual question "Will my dog be in heaven?") could not be run on the live site. The content audit below is from the prompts and code, which fully determine what the old app would have produced.

### Fairness: where traditions were caricatured or given words
The old app asked the model to role-play a theologian of each tradition ("You are a Reformed theologian… use we/our… begin making your argument"). That design puts invented first-person advocacy in each tradition's mouth, with nothing to check it against. Specific problems in `lib/tradition-pool.ts`:
- **Unequal register.** Reformed, Wesleyan and Open Theism are told to write with "scholarly precision"; Fundamentalists get "conviction and plain-spoken directness"; Word of Faith gets "confident, declarative faith". The reader sees some traditions as scholars and others as preachers.
- **Critics' labels as self-descriptions.** Open Theism is tagged "God Learns". Word of Faith is tagged "Prosperity · Confession · Health & Wealth" and told its framework includes believers as "little gods", a phrase its critics lead with. Mainline is described as putting "this-worldly justice over otherworldly salvation". Fundamentalists are defined partly by "suspicion".
- **Wrong or contested "key voices".** Progressive Evangelical lists Brian McLaren, Rob Bell and Rachel Held Evans, who left the evangelical label, and N.T. Wright, who isn't in this stream. Mainline lists Spong and Bultmann, not representative of what mainline denominations officially teach. Word of Faith lists Joel Osteen, who doesn't identify with it. Conservative Evangelical has "Tim Keller (in his more conservative moments)".
- **Groupings that blur real differences.** "Mainline" folds in the ELCA, which is Lutheran in its sacramental theology. "Reformed" ignores Reformed Baptists, who reject infant baptism.
- **All-Protestant pool.** No Lutheran, Roman Catholic or Orthodox view exists, so on the Lord's Supper and baptism the app can't show the views most American Christians hold or the ones the classic "four views" books compare. Kept as Sven chose; packaged as a decision.
- **The optional "theologian" box** wrote 350-400 words in first person as any named person, living or dead, with the instruction "Do not break character or disclaim that you are an AI." That is invented speech attributed to real people (John Piper and N.T. Wright are the placeholder examples).

### Sources
- None shown. Perplexity returns citations, but the old code kept only the text stream and threw the citation list away, so any [1] markers in the text pointed nowhere.
- No document-level sourcing (confessions, catechisms, official statements) was requested.
- No way to tell whether a tradition is settled or divided on the question.

### Usefulness
- Four essays and nothing else: no "where they agree", no "where exactly they part ways and why", no terms used differently, no reading list.
- The AI picks the four traditions without telling the reader why.

### Design and sharing
- Dark-only, generic centered form; tradition colors by Tailwind palette (red for Fundamentalists).
- No topic URL: the address bar stays on `/`, so nothing can be shared or bookmarked. Same page title for every topic, no preview image, no sitemap.
- Phone: the header crams the topic box, theologian box and button into two rows; the four essays stack with no way to compare.

### Safety and cost
- No cache: every visit to the same topic pays again. No rate limit, no spend cap, no input length limit. The topic and the theologian name were pasted straight into prompts (the theologian name into the system prompt).
- Cost per query (estimate from Perplexity's published sonar-pro pricing: $3/M input, $15/M output, about $6 per 1,000 requests at low search context; not measured because both keys are dead): 1 selection call (~$0.009) + 4 view calls (~$0.016 each) ≈ **$0.07 per topic, ~$0.09 with the theologian box, paid on every request**.

### Dependencies
- Next 16.4.6 (patched Nov 12), React 19.2, Tailwind 4: current. `@anthropic-ai/sdk` was installed but unused. Model `sonar-pro` hard-coded.

## 2. What great looks like
1. **Fair.** Each view in the tradition's own vocabulary at its strongest, third person, same length and register for all four, no default tradition, no winner. Divided or unofficial positions are labeled.
2. **Sourced.** Each view cites the tradition's own confessions, catechisms, official statements and named theologians, with links that open and pinpoint locators; Scripture passages link to BibleGateway in the translation that tradition's churches usually read. No quotation marks around document text (paraphrase only), so nothing can be misquoted. Every link is machine-checked; a sample of locators is checked by hand per topic.
3. **Useful.** Where they agree; where exactly they part ways and why (a real comparison grid); the same word meaning different things; where to read more, including multi-view books.
4. **Designed.** Reads like a reference work. The comparison works on a phone.
5. **Shareable.** `/t/{topic}` links, a preview image per topic, proper titles, sitemap.
6. **Safe and cheap.** Topics cached in Neon (free), per-visitor limits, a daily spend cap with a friendly fallback, guarded input, no keys in the browser. Two visitors asking the same new topic pay once.
7. **Current.** Engine choice packaged (Claude with web search restricted to each tradition's own sites, or Perplexity), model ids from current docs.
8. **Honest.** A visible note: a summary to start from; the sources are the authority.

## 3. Steps
1. Shared contract: topic schema, fair tradition profiles, API shapes, Scripture and link checks. *(done)*
2. In parallel: six checked seed topics; the engine (prompts, Claude and Perplexity adapters, validation, mock); cache, limits, spend cap, API; the UI; share/SEO.
3. Integrate, build, private preview, walk all six topics at desktop and phone width; independent review.
4. Fix review findings; docs; decisions.

## 4. Before and after
_(filled in at the end)_
