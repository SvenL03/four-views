"use client";

import { ViewState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ViewCardProps {
  viewState: ViewState;
}

export function ViewCard({ viewState }: ViewCardProps) {
  const { tradition, text, isLoading, isComplete, error } = viewState;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden",
        "border-l-4",
        tradition.accentColor
      )}
    >
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
        <span
          className={cn(
            "inline-block text-xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded",
            tradition.badgeClass
          )}
        >
          {tradition.shortName}
        </span>
        <p className="mt-2 text-sm text-[#888] leading-snug">{tradition.description}</p>
      </div>

      {/* Card Body */}
      <div className="flex-1 px-5 py-4">
        {isLoading && !text && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-[#2a2a2a] rounded w-full" />
            <div className="h-3 bg-[#2a2a2a] rounded w-5/6" />
            <div className="h-3 bg-[#2a2a2a] rounded w-full" />
            <div className="h-3 bg-[#2a2a2a] rounded w-4/6" />
            <div className="h-3 bg-[#2a2a2a] rounded w-full" />
            <div className="h-3 bg-[#2a2a2a] rounded w-3/4" />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {text && (
          <div
            className={cn(
              "prose prose-sm prose-invert max-w-none",
              "prose-p:text-[#d4d4d4] prose-p:leading-relaxed prose-p:font-serif",
              !isComplete && "cursor-blink"
            )}
            style={{ fontFamily: "var(--font-lora), Georgia, serif" }}
          >
            {text.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {isComplete && text && (
        <div className="px-5 pb-3 pt-1">
          <p className="text-xs text-[#555]">
            {text.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>
      )}
    </div>
  );
}
