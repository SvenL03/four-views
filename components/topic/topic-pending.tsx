"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { GetTopicResponse } from "@/lib/api-contract";
import type { Topic, TopicSummary, View } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { hueStyle, TraditionChips } from "@/components/tradition";
import { requestTopic } from "@/components/topic-search";

type State =
  | { kind: "loading" }
  | { kind: "pending"; viewsDone: number; partial?: Partial<Topic> }
  | { kind: "missing" }
  | { kind: "writing" }
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };

const SMALL = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
]);

function titleFromSlug(slug: string): string {
  let raw = slug;
  try {
    raw = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return raw
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

async function fetchTopic(slug: string): Promise<GetTopicResponse> {
  try {
    const res = await fetch(`/api/topics/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const data = (await res
      .json()
      .catch(() => null)) as GetTopicResponse | null;
    if (data && typeof data === "object" && "status" in data) return data;
    if (res.status === 404) return { status: "missing" };
    return {
      status: "error",
      message: "The server sent an answer we couldn’t read.",
    };
  } catch {
    return {
      status: "error",
      message: "We couldn’t reach the server. Check your connection.",
    };
  }
}

export function TopicPending({
  slug,
  written = [],
}: {
  slug: string;
  written?: TopicSummary[];
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [polling, setPolling] = useState(true);
  const failures = useRef(0);
  const title = titleFromSlug(slug);

  const tick = useCallback(async () => {
    const r = await fetchTopic(slug);
    switch (r.status) {
      case "ready":
        setPolling(false);
        router.refresh();
        return;
      case "pending":
        failures.current = 0;
        setState({
          kind: "pending",
          viewsDone: r.viewsDone,
          partial: r.partial,
        });
        return;
      case "missing":
        setPolling(false);
        setState({ kind: "missing" });
        return;
      default:
        failures.current += 1;
        if (failures.current >= 3) {
          setPolling(false);
          setState({ kind: "error", message: r.message });
        }
    }
  }, [slug, router]);

  useEffect(() => {
    if (!polling) return;
    let alive = true;
    let timer: number | undefined;
    const loop = async () => {
      await tick();
      if (alive) timer = window.setTimeout(loop, 2000);
    };
    loop();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [polling, tick]);

  async function write() {
    setState({ kind: "writing" });
    const r = await requestTopic(title);
    if (r.status === "ready" || r.status === "pending") {
      if (r.slug === slug) {
        failures.current = 0;
        setState({ kind: "pending", viewsDone: 0 });
        setPolling(true);
      } else {
        router.push(`/t/${r.slug}`);
      }
      return;
    }
    if (r.status === "error") setState({ kind: "error", message: r.message });
    else if (r.status === "limited")
      setState({ kind: "notice", message: r.message });
    else setState({ kind: "notice", message: r.message });
  }

  const partial = state.kind === "pending" ? state.partial : undefined;
  const done = state.kind === "pending" ? state.viewsDone : 0;
  const ids = partial?.traditionIds;

  if (
    state.kind === "missing" ||
    state.kind === "notice" ||
    state.kind === "writing"
  ) {
    return (
      <div className="wrap pt-10 pb-28 sm:pt-16 sm:pb-40">
        <h1 className="title max-w-[16ch]">{title}</h1>
        <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="max-w-[40rem]">
            <p className="statement">Nobody has asked about this one yet.</p>
            <p className="mt-5">
              Four Views can write it now: four traditions, each in its own
              words and from its own documents. It takes a minute or two.
            </p>
            {state.kind === "notice" && (
              <p
                className="ui mt-5 rounded-[1.25rem] bg-paper-3 px-5 py-4 text-base"
                role="status"
              >
                {state.message}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn"
                onClick={write}
                disabled={state.kind === "writing"}
              >
                {state.kind === "writing" && (
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                Write &ldquo;{title}&rdquo;
              </button>
              <Link href="/#topics" className="btn btn-quiet">
                See the written topics
              </Link>
            </div>
          </div>
          {written.length > 0 && (
            <div>
              <h2 className="h3">Already written</h2>
              <ul className="mt-4 grid gap-1">
                {written.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/t/${t.slug}`}
                      className="link inline-flex min-h-11 items-center text-[1.25rem] font-semibold"
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="wrap pt-10 pb-28 sm:pt-16 sm:pb-40">
        <h1 className="title max-w-[16ch]">{title}</h1>
        <p className="statement mt-10 max-w-[40rem]">
          This page didn&rsquo;t load.
        </p>
        <p className="mt-4 max-w-[40rem]">{state.message}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn"
            onClick={() => {
              failures.current = 0;
              setState({ kind: "loading" });
              setPolling(true);
            }}
          >
            Try again
          </button>
          <Link href="/" className="btn btn-quiet">
            Back to all topics
          </Link>
        </div>
      </div>
    );
  }

  const views = (partial?.views ?? []) as View[];

  return (
    <div className="wrap pt-8 pb-28 sm:pt-14 sm:pb-40">
      <h1 className="title max-w-[16ch]">{partial?.title ?? title}</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          {partial?.question && (
            <p className="statement measure">{partial.question}</p>
          )}
          {partial?.intro && <p className="mt-6 measure">{partial.intro}</p>}
          {!partial?.question && (
            <p className="statement measure">
              Choosing the four traditions that disagree most usefully on this
              question.
            </p>
          )}
        </div>
        <div>
          <p className="ui flex items-center gap-3 font-semibold tabular-nums" role="status">
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {state.kind === "loading"
              ? "Checking…"
              : `Writing the views: ${done} of 4 done`}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => {
              const id = ids?.[i];
              return (
                <span
                  key={i}
                  className={`h-2 rounded-full ${i < done ? "tr tr-mark" : i === done ? "bg-paper-3 pulse" : "bg-paper-3"}`}
                  style={id ? hueStyle(id) : undefined}
                />
              );
            })}
          </div>
          {ids && <TraditionChips ids={ids} className="mt-6" />}
          <p className="ui mt-6 text-base text-ink-2">
            Each view is written from its tradition&rsquo;s own documents, then
            its citations are checked. You can stay on this page; it fills in as
            each view is finished.
          </p>
        </div>
      </div>

      {views.length > 0 && (
        <section aria-labelledby="partial-h" aria-busy="true" className="mt-24">
          <h2 id="partial-h" className="h2">
            Finished so far
          </h2>
          <div className="mt-10 grid gap-16 lg:grid-cols-2">
            {views.map((v) => (
              <div
                key={v.traditionId}
                className="tr fade-in min-w-0"
                style={hueStyle(v.traditionId)}
              >
                <span
                  className="tr-mark block h-1.5 w-14 rounded-full"
                  aria-hidden="true"
                />
                <h3 className="h3 tr-text mt-5">
                  {TRADITIONS[v.traditionId]?.name}
                </h3>
                <p className="mt-4 font-serif text-[1.5rem] leading-[1.25] measure">
                  {v.headline}
                </p>
                <div className="prose-fv mt-4 measure">
                  {(v.body ?? []).map((p, i) => (
                    <p key={i}>
                      {p.replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "")}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
