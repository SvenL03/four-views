# Decisions for Sven: Four Views rework

Answer by number: yes/no or one word. My recommendation is listed first.

1. **Engine: Claude or Perplexity?** Both Perplexity keys are dead (production key invalid, local key out of credits), so nobody can write a new topic today; the six checked topics still work. **Recommend Claude** (Opus 5.5 with web search limited to each tradition's own sites; about COST_CLAUDE per new topic, then free from the cache) via an Anthropic API key you create with a monthly spend limit, added to the Vercel project as `ANTHROPIC_API_KEY`. Alternative: top up Perplexity and paste a fresh key (about COST_PPLX per new topic, weaker at fair, sourced writing). Answer: Claude / Perplexity / neither for now.
2. **Add Lutheran, Roman Catholic and Eastern Orthodox to the traditions?** Your ten are all Protestant, so on the Lord's Supper and baptism the app can't show the views most American Christians hold, or the ones the classic four-views books compare. The three profiles are written and switched off. **Recommend yes.**
3. **Daily spend cap: $2/day?** New topics stop for the day (with a friendly note and links to written topics) once the cap is reached. **Recommend yes ($2/day ≈ COST_PER_DAY new topics).**
4. **Go live after the review?** Replace the broken production site with the rework (merge `rework-2026-11` into `main`). **Recommend yes**, once the independent review's fixes are in.
5. **Custom domain?** **Recommend not now**: keep four-views.vercel.app; revisit a `svenhq.com` subdomain after the DNS move to Vercel.
