"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Share } from "lucide-react";

export function ShareBar({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setCanShare(coarse && typeof navigator.share === "function");
  }, []);

  async function copy() {
    const url = window.location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function share() {
    try {
      await navigator.share({ title, text, url: window.location.href.split("#")[0] });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canShare && (
        <button type="button" onClick={share} className="btn">
          <Share className="size-4" aria-hidden="true" />
          Share
        </button>
      )}
      <button type="button" onClick={copy} className={canShare ? "btn btn-quiet" : "btn"}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
