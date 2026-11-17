"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { CreateTopicResponse } from "@/lib/api-contract";
import type { TopicSummary } from "@/lib/schema";

type Notice =
  | { kind: "rejected"; message: string; suggestion?: string }
  | { kind: "paused"; message: string; suggestions: TopicSummary[] }
  | { kind: "limited"; message: string; retryAfterSeconds: number }
  | { kind: "error"; message: string };

function about(n: number, unit: string): string {
  return `about ${n} ${unit}${n === 1 ? "" : "s"}`;
}

function waitText(seconds: number): string {
  if (seconds < 90) return about(Math.max(1, Math.round(seconds)), "second");
  const min = Math.round(seconds / 60);
  if (min < 90) return about(min, "minute");
  return about(Math.round(min / 60), "hour");
}

export async function requestTopic(query: string): Promise<CreateTopicResponse> {
  try {
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = (await res.json().catch(() => null)) as CreateTopicResponse | null;
    if (data && typeof data === "object" && "status" in data) return data;
    return { status: "error", message: "The server sent an answer we couldn’t read. Try again in a moment." };
  } catch {
    return { status: "error", message: "We couldn’t reach the server. Check your connection and try again." };
  }
}

export function TopicSearch({ autoFocus = false, stacked = false }: { autoFocus?: boolean; stacked?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function submit(q: string) {
    const text = q.trim();
    if (busy) return;
    if (text.length < 2) {
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setNotice(null);
    const r = await requestTopic(text);
    switch (r.status) {
      case "ready":
      case "pending":
        router.push(`/t/${r.slug}`);
        return; // keep busy until navigation
      case "rejected":
        setNotice({ kind: "rejected", message: r.message, suggestion: r.suggestion });
        break;
      case "paused":
        setNotice({ kind: "paused", message: r.message, suggestions: r.suggestions ?? [] });
        break;
      case "limited":
        setNotice({ kind: "limited", message: r.message, retryAfterSeconds: r.retryAfterSeconds });
        break;
      default:
        setNotice({ kind: "error", message: r.message });
    }
    setBusy(false);
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className={stacked ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row"}
      >
        <label htmlFor="topic-q" className="sr-only">
          A doctrine or question
        </label>
        <input
          ref={inputRef}
          id="topic-q"
          name="q"
          type="text"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={160}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="The Sabbath, or: Is hell eternal?"
          className="field flex-1"
          aria-describedby={notice ? "topic-q-notice" : undefined}
        />
        <button type="submit" className={stacked ? "btn min-h-14 px-6 text-base sm:self-start" : "btn min-h-14 px-6 text-base"} disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Opening…
            </>
          ) : (
            <>
              Compare the views
              <ArrowRight className="size-5" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div id="topic-q-notice" aria-live="polite" className="ui mt-4 text-base">
        {notice && (
          <div className="fade-in rounded-[1.25rem] bg-paper-3 px-5 py-4">
            {notice.kind === "rejected" && (
              <>
                <p>{notice.message}</p>
                {notice.suggestion && (
                  <p className="mt-2">
                    Did you mean{" "}
                    <button
                      type="button"
                      className="link font-semibold min-h-11 cursor-pointer"
                      onClick={() => {
                        setQuery(notice.suggestion!);
                        submit(notice.suggestion!);
                      }}
                    >
                      {notice.suggestion}
                    </button>
                    ?
                  </p>
                )}
              </>
            )}
            {notice.kind === "paused" && (
              <>
                <p>
                  {notice.message}
                </p>
                {notice.suggestions.length > 0 && (
                  <>
                    <p className="mt-2">These are ready to read:</p>
                    <ul className="mt-1 flex flex-wrap gap-x-5">
                      {notice.suggestions.map((s) => (
                        <li key={s.slug}>
                          <Link href={`/t/${s.slug}`} className="link inline-flex min-h-11 items-center font-semibold">
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {notice.kind === "limited" && (
              <p>
                {notice.message} You can ask again in {waitText(notice.retryAfterSeconds)}.
              </p>
            )}
            {notice.kind === "error" && <p>{notice.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
