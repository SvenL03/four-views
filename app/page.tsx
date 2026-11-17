import Link from "next/link";
import { listTopics } from "@/lib/topics";
import { activeTraditions } from "@/lib/traditions";
import { TopicSearch } from "@/components/topic-search";
import { TopicList } from "@/components/topic-list";
import { HonestNote } from "@/components/honest-note";
import { hueStyle } from "@/components/tradition";
import { rv } from "@/components/reveal-attrs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const topics = (await listTopics()).sort((a, b) => a.title.localeCompare(b.title));
  const traditions = activeTraditions();

  return (
    <>
      <section className="wrap pt-10 pb-20 sm:pt-16 sm:pb-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <h1 className="display rise" translate="no">Four Views</h1>
            <p className="statement measure mt-8 rise rise-2">
              One question, four American Christian traditions, each in its own words and with its
              own sources.
            </p>
          </div>
          <div className="rise rise-3 lg:pb-3">
            <h2 className="h3 mb-4">Ask about a doctrine or a question</h2>
            <TopicSearch stacked />
          </div>
        </div>
      </section>

      <section id="topics" aria-labelledby="topics-h" className="wrap pb-24 sm:pb-36">
        <h2 id="topics-h" className="h2 pb-4">
          Topics
        </h2>
        <TopicList topics={topics} />
      </section>

      <section aria-labelledby="how-h" className="wrap pb-24 sm:pb-36">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div {...rv()}>
            <h2 id="how-h" className="h2">
              How this works
            </h2>
            <p className="mt-6 measure">
              Four Views chooses the four traditions that disagree most usefully on your question,
              from a set of ten that shape American churches. Each one is stated the way its own
              people state it, sourced from its own confessions, statements and books. Citations are
              checked, and every finished topic is kept so the next reader gets the same page.
            </p>
            <p className="ui mt-6">
              <Link href="/about" className="link font-semibold inline-flex min-h-11 items-center">
                Read how the traditions are chosen and written
              </Link>
            </p>
          </div>
          <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 content-start" aria-label="The traditions">
            {traditions.map((t, i) => (
              <li key={t.id} className="tr grid grid-cols-[auto_1fr] gap-x-3" {...rv(Math.floor(i / 2) + 1, hueStyle(t.id))}>
                <span className="tr-swatch mt-[0.55rem]" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{t.name}</span>
                  <span className="ui block text-ink-2 mt-0.5">{t.emphases.join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HonestNote />
    </>
  );
}
