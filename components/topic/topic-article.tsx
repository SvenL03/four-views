import type { Topic, TraditionId } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { hueStyle, TraditionChips, TraditionLabel } from "@/components/tradition";
import { HonestNote } from "@/components/honest-note";
import { PartingsSection } from "./partings-section";
import { ViewsSection } from "./views-section";
import { ShareBar } from "./share-bar";
import { ArrowUpRight } from "lucide-react";
import { rv } from "@/components/reveal-attrs";

const SECTIONS = [
  { id: "partings", label: "Where they part ways" },
  { id: "agree", label: "Where they agree" },
  { id: "views", label: "In their own words" },
  { id: "terms", label: "Same word, different meaning" },
  { id: "reading", label: "Read more" },
];

function orderedViews(topic: Topic) {
  return topic.traditionIds
    .map((id) => topic.views.find((v) => v.traditionId === id))
    .filter((v): v is Topic["views"][number] => Boolean(v));
}

export function TopicArticle({ topic }: { topic: Topic }) {
  const ids = topic.traditionIds;
  const { synthesis: s } = topic;
  const views = orderedViews(topic);
  const sections = SECTIONS.filter(
    (x) =>
      (x.id !== "terms" || s.terms.length > 0) &&
      (x.id !== "agree" || s.common.length > 0) &&
      (x.id !== "reading" || s.furtherReading.length > 0),
  );

  const multi = s.furtherReading.filter((r) => r.traditionIds.length > 1);
  const byTradition = ids.map((id) => ({
    id,
    items: s.furtherReading.filter((r) => r.traditionIds.length === 1 && r.traditionIds[0] === id),
  }));

  return (
    <article>
      {/* a. header */}
      <header className="wrap pt-8 pb-20 sm:pt-14 sm:pb-28">
        <h1 className="title rise max-w-[16ch]">{topic.title}</h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="rise rise-2">
            <p
              className={
                topic.question.length > 120
                  ? "statement measure text-[clamp(1.25rem,1.9vw,1.625rem)]"
                  : "statement measure"
              }
            >
              {topic.question}
            </p>
            <p className="mt-6 measure">{topic.intro}</p>
          </div>
          <div className="rise rise-3 grid content-start gap-6">
            <div>
              <h2 className="ui font-semibold">The four traditions on this page</h2>
              <TraditionChips ids={ids} className="mt-3" />
              <p className="mt-4 text-base text-ink measure">{topic.whyTheseFour}</p>
            </div>
            <p className="ui text-base text-ink-2">
              A summary to start from; the sources are the authority.{" "}
              <a href="#note" className="link font-semibold text-ink">
                How to read this page
              </a>
            </p>
            <ShareBar
            title={/[?!]$/.test(topic.title) ? `${topic.title} Four Christian views` : `${topic.title}: four Christian views`}
            text={topic.question}
          />
          </div>
        </div>

        <nav aria-label="On this page" className="ui mt-14 rise rise-4">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {sections.map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`} className="link inline-flex min-h-11 items-center font-semibold">
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* b. partings */}
      <section id="partings" aria-labelledby="partings-h" className="wrap scroll-mt-4 pb-28 sm:pb-40">
        <div {...rv()} className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:items-end">
          <h2 id="partings-h" className="h2">
            Where they part ways
          </h2>
          <p className="ui text-base text-ink-2 measure">
            The questions that actually divide them, with each tradition&rsquo;s short answer. The
            full case for each is under In their own words.
          </p>
        </div>
        <PartingsSection partings={s.partings} ids={ids} />
      </section>

      {/* c. common ground */}
      {s.common.length > 0 && (
        <section id="agree" aria-labelledby="agree-h" className="bg-paper-2 scroll-mt-4">
          <div className="wrap grid gap-10 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div {...rv()}>
              <h2 id="agree-h" className="h2">
                Where they agree
              </h2>
              <p className="ui mt-4 text-base text-ink-2 measure">
                Ground all four stand on, whatever else divides them.
              </p>
            </div>
            <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {s.common.map((c, i) => (
                <li key={c} {...rv(i + 1)} className="grid grid-cols-[auto_1fr] gap-x-4">
                  <span className="mt-[0.7rem] flex gap-[3px]" aria-hidden="true">
                    {ids.map((id) => (
                      <span key={id} className="tr tr-mark h-3.5 w-[5px] rounded-full" style={hueStyle(id)} />
                    ))}
                  </span>
                  <span className="text-[1.25rem] leading-[1.4] tracking-[-0.005em]">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* d. the four views */}
      <section id="views" aria-labelledby="views-h" className="wrap scroll-mt-4 pt-28 pb-28 sm:pt-40 sm:pb-40">
        <div {...rv()} className="mb-6 grid gap-4 lg:mb-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:items-end">
          <h2 id="views-h" className="h2">
            In their own words
          </h2>
          <p className="ui text-base text-ink-2 measure">
            Each view as its own adherents would put it. Numbers point to that view&rsquo;s sources;
            Scripture opens in the translation the tradition usually reads.
          </p>
        </div>
        <ViewsSection views={views} />
      </section>

      {/* e. terms */}
      {s.terms.length > 0 && (
        <section id="terms" aria-labelledby="terms-h" className="wrap scroll-mt-4 pb-28 sm:pb-40">
          <h2 id="terms-h" className="h2" {...rv()}>
            Same word, different meaning
          </h2>
          <div className="mt-12 grid gap-14 lg:gap-16">
            {s.terms.map((term) => (
              <div key={term.term} {...rv(1)} className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
                <h3 className="font-serif font-semibold tracking-[-0.02em] leading-[1.05] text-[clamp(1.625rem,2.6vw,2.25rem)] text-balance break-words">
                  {term.term}
                </h3>
                <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                  {ids.map((id) => {
                    const m = term.meanings.find((x) => x.traditionId === id);
                    if (!m) return null;
                    return (
                      <div key={id} className="min-w-0">
                        <dt className="ui font-semibold">
                          <TraditionLabel id={id} />
                        </dt>
                        <dd className="mt-1.5 text-[1.125rem] leading-normal">{m.meaning}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* f. further reading */}
      {s.furtherReading.length > 0 && (
        <section id="reading" aria-labelledby="reading-h" className="bg-paper-2 scroll-mt-4">
          <div className="wrap py-20 sm:py-28">
            <h2 id="reading-h" className="h2" {...rv()}>
              Read more
            </h2>
            <p className="ui mt-4 text-base text-ink-2 measure">
              Each tradition&rsquo;s own best case, then books where the views answer each other.
            </p>
            <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {byTradition.map(({ id, items }, i) => (
                <div key={id} className="tr min-w-0" {...rv(i + 1, hueStyle(id))}>
                  <h3 className="ui font-semibold">
                    <TraditionLabel id={id} />
                  </h3>
                  {items.length === 0 ? (
                    <p className="ui mt-3 text-base text-ink-2">See the sources under its view above.</p>
                  ) : (
                    <ul className="mt-4 grid gap-5">
                      {items.map((r) => (
                        <ReadingItem key={r.title} r={r} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {multi.length > 0 && (
              <div {...rv(1)} className="mt-16 rounded-[1.5rem] bg-paper px-6 py-8 sm:px-10 sm:py-10">
                <h3 className="h3">Read the views side by side</h3>
                <ul className="mt-6 grid gap-8 md:grid-cols-2">
                  {multi.map((r) => (
                    <ReadingItem key={r.title} r={r} showTraditions />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* g. the honest note */}
      <HonestNote id="note" className="mt-0" />

      {/* h. share */}
      <section aria-labelledby="share-h" className="wrap py-20 sm:py-28">
        <div {...rv()} className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 id="share-h" className="h3">
              Pass it on
            </h2>
            <p className="mt-2 measure">
              Send this to someone you disagree with, and read it together.
            </p>
          </div>
          <ShareBar
            title={/[?!]$/.test(topic.title) ? `${topic.title} Four Christian views` : `${topic.title}: four Christian views`}
            text={topic.question}
          />
        </div>
      </section>
    </article>
  );
}

function ReadingItem({
  r,
  showTraditions = false,
}: {
  r: Topic["synthesis"]["furtherReading"][number];
  showTraditions?: boolean;
}) {
  return (
    <li className="min-w-0 break-words">
      <p className="font-serif text-[1.25rem] font-semibold leading-snug">
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="link">
            {r.title}
            <ArrowUpRight className="inline size-4 ml-0.5 -mt-0.5" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          r.title
        )}
      </p>
      <p className="ui text-base text-ink-2">{r.author}</p>
      <p className="mt-1.5 text-base">{r.note}</p>
      {showTraditions && (
        <p className="ui mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] text-ink-2">
          {r.traditionIds.map((id: TraditionId) => (
            <TraditionLabel key={id} id={id} short />
          ))}
        </p>
      )}
    </li>
  );
}

export function traditionNames(ids: TraditionId[]): string {
  return ids.map((id) => TRADITIONS[id].name).join(", ");
}
