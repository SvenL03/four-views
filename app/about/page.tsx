import type { Metadata } from "next";
import Link from "next/link";
import { activeTraditions } from "@/lib/traditions";
import { hueStyle } from "@/components/tradition";
import { rv } from "@/components/reveal-attrs";
import { HonestNote } from "@/components/honest-note";

export const metadata: Metadata = {
  title: "How Four Views works",
  description:
    "How Four Views chooses four traditions for a question, writes each in its own words from its own documents, and checks the citations.",
  alternates: { canonical: "/about" },
};

const STEPS = [
  {
    h: "Four traditions are chosen for your question",
    p: "Not every tradition has something distinct to say about every doctrine. For each question, Four Views picks the four of the traditions below whose answers differ most usefully, and says on the page why those four.",
  },
  {
    h: "Each one speaks in its own words",
    p: "A view is written the way a thoughtful adherent would state it, in that tradition's vocabulary and at its strongest, never in its critics' terms. Where a tradition is divided, the page says so.",
  },
  {
    h: "From its own documents",
    p: "Every view is built from what the tradition itself has published: its creeds, confessions and catechisms, its denominational statements, and the books its own teachers recommend. Each claim carries a number that points to the source.",
  },
  {
    h: "The citations are checked",
    p: "Links are opened, Scripture references are checked against the books and chapters that exist, and anything that cannot be traced is taken out before a topic goes up.",
  },
  {
    h: "Then it is kept",
    p: "A finished topic is saved, so the next person who asks reads the same page, and corrections stay corrected.",
  },
];

export default function AboutPage() {
  const traditions = activeTraditions();
  return (
    <>
      <header className="wrap pt-10 pb-20 sm:pt-16 sm:pb-28">
        <h1 className="title max-w-[14ch] rise">How Four Views works</h1>
        <p className="statement measure mt-10 rise rise-2">
          Christians disagree about real things. Four Views lets each side say what it believes,
          in its own words, so you can understand it before you answer it.
        </p>
      </header>

      <section aria-labelledby="steps-h" className="wrap pb-28 sm:pb-40">
        <h2 id="steps-h" className="h2">
          From question to page
        </h2>
        <ol className="mt-12 grid gap-x-16 gap-y-12 md:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.h} className="max-w-[36rem]" {...rv(i % 2)}>
              <h3 className="h3">{s.h}</h3>
              <p className="mt-3">{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="trad-h" className="bg-paper-2">
        <div className="wrap py-20 sm:py-28">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
            <h2 id="trad-h" className="h2">
              The {traditions.length === 10 ? "ten" : traditions.length} traditions
            </h2>
            <p className="ui text-base text-ink-2 measure">
              The streams that shape most American churches, each described the way its own people
              describe it. Each has its own color, set at equal strength so none stands out.
            </p>
          </div>
          <ul className="mt-14 grid gap-x-16 gap-y-16 lg:grid-cols-2">
            {traditions.map((t, i) => (
              <li key={t.id} className="tr min-w-0" id={t.id} {...rv(i % 2, hueStyle(t.id))}>
                <span className="tr-mark block h-1.5 w-14 rounded-full" aria-hidden="true" />
                <h3 className="h3 mt-4">{t.name}</h3>
                <p className="ui mt-1 text-ink-2">{t.emphases.join(" · ")}</p>
                <p className="mt-4 measure">{t.about}</p>
                <dl className="mt-5 grid gap-4 measure">
                  <div>
                    <dt className="ui font-semibold">Where you find it</dt>
                    <dd className="mt-1 text-base">{t.bodies.join("; ")}</dd>
                  </div>
                  <div>
                    <dt className="ui font-semibold">Where it is divided</dt>
                    <dd className="mt-1 text-base">{t.diversity}</dd>
                  </div>
                  <div>
                    <dt className="ui font-semibold">Scripture links open in</dt>
                    <dd className="mt-1 text-base">{t.translation}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HonestNote />

      <section aria-labelledby="start-h" className="wrap py-20 sm:py-28">
        <h2 id="start-h" className="h3">
          Start with a topic
        </h2>
        <p className="mt-3">
          <Link href="/#topics" className="link font-semibold">
            See every written topic
          </Link>{" "}
          or ask your own question on the front page.
        </p>
      </section>
    </>
  );
}
