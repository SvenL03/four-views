"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Synthesis, TraditionId } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { hueStyle, TraditionLabel } from "@/components/tradition";
import { cn } from "@/lib/utils";
import { rv } from "@/components/reveal-attrs";

type Parting = Synthesis["partings"][number];

function answerFor(p: Parting, id: TraditionId): string {
  return p.answers.find((a) => a.traditionId === id)?.answer ?? "No answer recorded.";
}

function PairSelect({
  label,
  value,
  ids,
  onChange,
}: {
  label: string;
  value: TraditionId;
  ids: TraditionId[];
  onChange: (id: TraditionId) => void;
}) {
  return (
    <label className="ui grid gap-1 min-w-0">
      <span className="sr-only">{label}</span>
      <span className="tr relative block" style={hueStyle(value)}>
        <span className="tr-swatch pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <select
          className="select pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value as TraditionId)}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {TRADITIONS[id].short}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export function PartingsSection({ partings, ids }: { partings: Parting[]; ids: TraditionId[] }) {
  const [mode, setMode] = useState<"all" | "two">("all");
  const [a, setA] = useState<TraditionId>(ids[0]);
  const [b, setB] = useState<TraditionId>(ids[1]);

  function pickA(id: TraditionId) {
    if (id === b) setB(a);
    setA(id);
  }
  function pickB(id: TraditionId) {
    if (id === a) setA(b);
    setB(id);
  }

  const shown = mode === "all" ? ids : [a, b];

  return (
    <>
      {/* Wide: a true comparison grid, questions down, traditions across. */}
      <div className="hidden lg:block">
        <table className="cmp">
          <caption className="sr-only">
            Each question where the four traditions part ways, with each tradition&rsquo;s short answer
          </caption>
          <colgroup>
            <col className="w-[24%]" />
            {ids.map((id) => (
              <col key={id} className="w-[19%]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td aria-hidden="true" />
              {ids.map((id) => (
                <th key={id} scope="col" className="tr" style={hueStyle(id)}>
                  <span className="tr-mark mb-3 block h-1.5 w-10 rounded-full" aria-hidden="true" />
                  <span className="tr-text block font-serif text-[1.25rem] font-semibold leading-tight">
                    {TRADITIONS[id].name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partings.map((p) => (
              <tr key={p.question}>
                <th scope="row">
                  <span className="h3 block">{p.question}</span>
                  <span className="ui mt-3 block text-base font-normal text-ink-2">{p.why}</span>
                </th>
                {ids.map((id) => (
                  <td key={id} className="text-base leading-[1.55]">
                    {answerFor(p, id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow: one question at a time, all four stacked, or two side by side. */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-20 -mx-4 bg-paper px-4 py-2">
          <div className="seg" role="group" aria-label="How many traditions to show">
            <button
              type="button"
              className="seg-btn"
              aria-pressed={mode === "all"}
              onClick={() => setMode("all")}
            >
              All four
            </button>
            <button
              type="button"
              className="seg-btn"
              aria-pressed={mode === "two"}
              onClick={() => setMode("two")}
            >
              Compare two
            </button>
          </div>
          {mode === "two" && (
            <div className="fade-in mt-2 grid grid-cols-2 gap-2">
              <PairSelect label="First tradition" value={a} ids={ids} onChange={pickA} />
              <PairSelect label="Second tradition" value={b} ids={ids} onChange={pickB} />
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          {partings.map((p) => (
            <article key={p.question} {...rv()} className="rounded-[1.25rem] bg-paper-2 px-4 py-6 min-[400px]:px-5 sm:px-7">
              <h3 className="h3">{p.question}</h3>
              <p className="ui mt-2 text-base text-ink-2">{p.why}</p>
              <dl
                className={cn(
                  "mt-5 grid gap-x-4 gap-y-5 sm:gap-x-6",
                  mode === "two" ? "grid-cols-2" : "sm:grid-cols-2",
                )}
              >
                {shown.map((id) => (
                  <div key={id} className="min-w-0">
                    <dt className="ui font-semibold">
                      <TraditionLabel id={id} short={mode === "two"} />
                    </dt>
                    <dd className={cn("mt-1.5 leading-normal", mode === "two" ? "text-base" : "text-[1.125rem]")}>
                      {answerFor(p, id)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
