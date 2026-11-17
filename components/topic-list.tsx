import Link from "next/link";
import type { TopicSummary } from "@/lib/schema";
import { TraditionLabel } from "@/components/tradition";
import { rv } from "@/components/reveal-attrs";

export function TopicList({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) {
    return (
      <p className="measure text-ink-2">
        The first topics are being written and checked. Ask a question above, or come back shortly.
      </p>
    );
  }
  return (
    <ul className="grid">
      {topics.map((t, i) => (
        <li key={t.slug} className="group" {...rv(i % 3)}>
          <Link
            href={`/t/${t.slug}`}
            className="grid gap-x-12 gap-y-4 py-8 sm:py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] transition-colors hover:bg-paper-2 -mx-4 px-4 rounded-[1.25rem]"
          >
            <h3 className="font-serif font-semibold tracking-[-0.025em] leading-[1.02] text-[clamp(2rem,4.2vw,3.5rem)] text-balance break-words group-hover:underline decoration-2 underline-offset-[0.12em]">
              {t.title}
            </h3>
            <span className="grid gap-4 content-start lg:pt-2">
              <span className="text-[1.25rem] leading-snug">{t.question}</span>
              <span className="ui order-first flex flex-wrap gap-x-4 gap-y-1.5 text-ink-2 lg:order-none">
                {t.traditionIds.map((id) => (
                  <TraditionLabel key={id} id={id} />
                ))}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
