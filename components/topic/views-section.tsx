"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { View } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { hueStyle } from "@/components/tradition";
import { useMedia } from "@/components/use-media";
import { cn } from "@/lib/utils";
import { ViewArticle } from "./view-article";

/**
 * The four full views. Wide screens: a 2x2 reading spread.
 * Below 1024px: a sticky tab switcher between the four.
 */
export function ViewsSection({ views }: { views: View[] }) {
  const wide = useMedia("(min-width: 1024px)");
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelsTop = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  function select(i: number, focus = false) {
    setActive(i);
    setTouched(true);
    if (focus) tabs.current[i]?.focus();
    // start the new view at its top when the reader is deep in the old one
    const top = panelsTop.current?.getBoundingClientRect().top ?? 0;
    const barH = bar.current?.offsetHeight ?? 0;
    if (top < barH) {
      window.scrollTo({ top: window.scrollY + top - barH - 8 });
    }
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = views.length;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      select(next, true);
    }
  }

  return (
    <div>
      <div
        ref={bar}
        className="sticky top-0 z-20 -mx-4 bg-paper px-4 py-2 lg:hidden"
      >
        <div
          role="tablist"
          aria-label="Choose a tradition"
          className="seg grid grid-cols-2 rounded-[1.5rem] min-[520px]:flex min-[520px]:rounded-full"
        >
          {views.map((v, i) => {
            const t = TRADITIONS[v.traditionId];
            return (
              <button
                key={v.traditionId}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`tab-${v.traditionId}`}
                aria-selected={active === i}
                aria-controls={`panel-${v.traditionId}`}
                tabIndex={active === i ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={(e) => onKey(e, i)}
                className="seg-btn tr"
                style={hueStyle(v.traditionId)}
              >
                <span className="tr-swatch" aria-hidden="true" />
                <span className="truncate">{t.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={panelsTop} className="grid gap-x-16 gap-y-24 pt-8 lg:grid-cols-2 lg:pt-4">
        {views.map((v, i) => (
          <div
            key={v.traditionId}
            id={`panel-${v.traditionId}`}
            role={wide ? undefined : "tabpanel"}
            aria-labelledby={wide ? undefined : `tab-${v.traditionId}`}
            tabIndex={wide ? undefined : 0}
            className={cn(active === i ? (touched ? "block fade-in" : "block") : "hidden", "lg:block min-w-0 focus-visible:outline-offset-8")}
          >
            <ViewArticle view={v} />
          </div>
        ))}
      </div>
    </div>
  );
}
