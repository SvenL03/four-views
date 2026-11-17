import { ArrowUpRight, BookOpen } from "lucide-react";
import { scriptureUrl, type View } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { hueStyle } from "@/components/tradition";
import { CitedText } from "./cited-text";
import { cn } from "@/lib/utils";
import { rv } from "@/components/reveal-attrs";

const CONSENSUS: Record<View["consensus"], { label: string; level: number; plain: string }> = {
  settled: { label: "Settled", level: 3, plain: "The tradition speaks with one voice here." },
  mostly: { label: "Mostly agreed", level: 2, plain: "Most within the tradition hold this." },
  divided: { label: "Divided", level: 1, plain: "The tradition is genuinely split." },
  "no-official-position": {
    label: "No official position",
    level: 0,
    plain: "The tradition has not ruled on this.",
  },
};

function sourceLine(s: View["sources"][number]): string {
  return [s.author, s.publisher, s.year ?? undefined, s.locator].filter(Boolean).join(", ");
}

export function ConsensusBadge({ view }: { view: View }) {
  const c = CONSENSUS[view.consensus];
  return (
    <div className="tr-tint rounded-[1.25rem] px-5 py-4">
      <p className="ui flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn("h-2 w-5 rounded-full", n <= c.level ? "tr-mark" : "bg-paper")}
            />
          ))}
        </span>
        <span className="font-semibold">
          <span className="sr-only">Consensus: </span>
          {c.label}
        </span>
      </p>
      <p className="ui mt-1.5 text-base">{view.consensusNote ?? c.plain}</p>
    </div>
  );
}

export function ViewArticle({ view, headingLevel = 3 }: { view: View; headingLevel?: 3 | 4 }) {
  const t = TRADITIONS[view.traditionId];
  const anchor = view.traditionId;
  const H = headingLevel === 3 ? "h3" : "h4";
  const Sub = headingLevel === 3 ? "h4" : "h5";
  const titles = view.sources.map((s) => s.title);
  return (
    <article className="tr min-w-0" style={hueStyle(view.traditionId)} aria-labelledby={`view-${anchor}`}>
      <span {...rv()} className="tr-mark block h-1.5 w-14 rounded-full origin-left" aria-hidden="true" />
      <H id={`view-${anchor}`} className="h3 tr-text mt-5">
        {t.name}
      </H>
      <p className="ui mt-2 text-ink-2 measure">{t.about}</p>

      <p {...rv(1)} className="mt-7 font-serif text-[clamp(1.375rem,1.7vw,1.5rem)] leading-[1.28] tracking-[-0.012em] text-pretty measure">
        {view.headline}
      </p>

      <div {...rv(2)} className="prose-fv mt-6 measure">
        {view.body.map((p, i) => (
          <p key={i}>
            <CitedText text={p} anchor={anchor} sourceCount={view.sources.length} sourceTitles={titles} />
          </p>
        ))}
      </div>

      <div {...rv(1)} className="mt-8 measure">
        <ConsensusBadge view={view} />
      </div>

      {view.keyTexts.length > 0 && (
        <div {...rv(1)} className="mt-10 measure">
          <Sub className="font-serif text-[1.125rem] font-semibold">
            Scripture they lean on
            <span className="ui ml-2 font-normal text-ink-2">({t.translation})</span>
          </Sub>
          <ul className="mt-3 grid gap-3">
            {view.keyTexts.map((k) => (
              <li key={k.ref} className="grid grid-cols-[auto_1fr] gap-x-3">
                <BookOpen className="tr-text mt-[0.35rem] size-4" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <a
                    href={scriptureUrl(k.ref, t.translation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link font-semibold"
                  >
                    {k.ref}
                    <span className="sr-only"> ({t.translation}, opens BibleGateway in a new tab)</span>
                  </a>
                  <span className="text-ink"> {k.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div {...rv(1)} className="mt-10 measure">
        <Sub className="font-serif text-[1.125rem] font-semibold">Sources</Sub>
        <ol className="mt-3 grid gap-1">
          {view.sources.map((s, i) => (
            <li
              key={s.id}
              id={`src-${anchor}-${i + 1}`}
              className="grid grid-cols-[1.75rem_1fr] gap-x-2 -mx-2 px-2 py-2"
            >
              <span className="ui tr-text font-semibold tabular-nums pt-[0.15rem]">{i + 1}</span>
              <span className="ui min-w-0 text-base break-words">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link font-semibold text-[1.125rem] inline"
                >
                  {s.title}
                  <ArrowUpRight className="inline size-4 ml-0.5 -mt-0.5" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {sourceLine(s) && <span className="block text-ink-2">{sourceLine(s)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
