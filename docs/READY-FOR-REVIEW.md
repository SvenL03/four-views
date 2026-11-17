# Four Views: ready for review

**Written:** 2026-11-16 7:43 PM ET · **Branch:** `rework-2026-11` (commit `HEAD`, pushed) · **Production:** untouched.

## Preview

- **URL (stable, always the latest push of the branch):** https://four-views-git-rework-2026-11-sven-pro-services.vercel.app (private: Vercel login required).
- **Without a Vercel login:** a 23-hour share link is in the group's notes folder, in `four-views-preview-access.md`. It's kept out of git because it works as an access token. Open it once; it sets a cookie for every path on that deployment.

## How to exercise the main flow

1. **Home:** the search box, the list of written topics, and how it works.
2. **Open each topic** at `/t/{slug}` and check, in order:
   - the header: question, intro, the four traditions and why these four;
   - **Where they part ways:** a grid on desktop with sticky tradition headers; on a phone, "All four" stacked, or "Compare two" with two pickers side by side;
   - **Where they agree;**
   - **In their own words:** a 2×2 grid on desktop, four tabs on a phone (arrow keys work);
   - superscript numbers jump to that view's numbered sources;
   - Scripture links open BibleGateway in the translation that tradition's churches usually read (ESV, NIV, KJV, CSB, NRSVUE, and so on);
   - the consensus badge (settled / mostly / divided / no official position) with its note;
   - **Same word, different meaning;**
   - **Read more;**
   - the honest note;
   - **Copy link.**
3. **Search box:**
   - a written topic in other words ("What do Christians believe about baptism?") goes straight to `/t/baptism`;
   - a new question ("Should Christians keep the Sabbath?") shows the "new topics aren't being written right now" note with links, because no engine key works today (see `DECISIONS-FOR-SVEN.md` #1);
   - junk (a link, code) is turned away politely.
4. **Other pages:**
   - `/about`;
   - an unknown topic URL such as `/t/the-sabbath`: a friendly "not written yet" page, marked noindex;
   - `/t/{slug}/opengraph-image`, `/sitemap.xml`, `/robots.txt`.

## Test topics

| Slug | The four traditions |
|---|---|
| `baptism` | Reformed, Mainline, Conservative Evangelical, Pentecostal |
| `the-lords-supper` | Reformed, Mainline, Wesleyan, Conservative Evangelical |
| `predestination-and-free-will` | Reformed, Wesleyan, Conservative Evangelical (SBC), Open Theism |
| `women-in-ministry` | Conservative Evangelical, Reformed, Wesleyan, Mainline |
| `the-end-times` | Dispensationalist, Reformed, Conservative Evangelical, Mainline |
| `will-my-dog-be-in-heaven` (the unusual question) | Reformed, Wesleyan, Conservative Evangelical, Mainline |

## What I verified

- **Build and tests:**
  - `next build` passes and `tsc` is clean.
  - Engine smoke test: 19/19 checks with the mock engine, plus faked Claude and Perplexity HTTP responses.
- **Topic checker:** `node scripts/check-topics.ts` passes all six topics. It checks:
  - the schema;
  - citation markers in range, and every source cited at least once;
  - no long quotations;
  - Scripture references against the canon;
  - that every source and reading-list URL opens.
- **Citations opened by the writers:** every source in every view, with locators checked against the text. Each file's `meta.reviewNotes` lists what was opened and what couldn't be verified.
- **Citations I re-opened myself** (all say what the view paraphrases):
  1. Heidelberg Catechism Q&A 74, infants included in the covenant, baptism replaces circumcision (crcna.org): baptism.
  2. EFCA Statement of Faith, Article 7: two ordinances that confirm and nourish the believer but are not means of salvation (efca.org): baptism and the Lord's Supper.
  3. Westminster Confession 3.5: election "without any foresight of faith, or good works" (opc.org): predestination.
  4. Church of the Nazarene Manual, para. 501: women may be elected and appointed to the offices of elder and deacon (nazarene.org): women in ministry.
  5. Larry Wilson, "Will You See Your Pet in Heaven?": hopes so, doesn't know, points to Christ (opc.org): dog.
  6. Dallas Theological Seminary doctrinal statement, Article XIX: the church in heaven during Israel's seventieth week (dts.edu): end times.
- **Browser walk-through** on the deployed preview:
  - all six topics, home, about, search and not-found;
  - desktop width (1024 and 1440) and phone width (375), light and dark;
  - no horizontal scroll at 375;
  - phone "Compare two" and view tabs work, with `aria-selected` updating;
  - all external links carry `rel=noopener`.
- **API on the preview:**
  - POST returns ready, paused with suggestions, or rejected;
  - GET returns ready, or 404 when missing;
  - search works;
  - the share image is 1200×630 PNG;
  - the sitemap lists home, about and the six topics.
- **Server logs:** Vercel runtime logs for the preview show no errors or warnings.

## Known open items

- **No live engine.** Both Perplexity keys are dead and there is no Anthropic key, so new-topic writing has never run against a real model. It's tested only with the mock and faked HTTP. The six topics are hand-supervised seeds, not engine output.
- **All-Protestant pool.** Lutheran, Catholic and Orthodox are off pending Sven's decision. On the Lord's Supper, the "Mainline" view leans on Episcopal and United Methodist documents (ELCA's site blocked automated reading), and Wesleyan is a separate column, so two of the four share Methodist roots.
- **Sites that block automated reading.** The Assemblies of God (ag.org), ELCA and the Nazarene Articles of Faith page couldn't be checked automatically, so the AG appears less than its size warrants, and Pentecostal views cite the Church of God (Cleveland) and the IPHC instead.
- **Reading lists.** Further-reading books listed without a URL weren't opened; their titles and editors come from the writers' knowledge.
- **Removed feature.** The old "write as a named theologian" box is gone: it produced invented first-person speech for real people.
- **Design review.** The `web-design-guidelines` review ran at 7:46 PM: 25 fixes applied (focus ring, touch handling, long-text wrapping, typography, `aria-busy` scope), 16 left with reasons (e.g. no contact channel for "Tell us what to fix" yet, view and compare state not in the URL).
