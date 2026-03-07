"use client";

import { TheologianState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface TheologianCardProps {
  state: TheologianState;
}

export function TheologianCard({ state }: TheologianCardProps) {
  const { name, text, isLoading, isComplete, error } = state;

  return (
    <div className="rounded-lg bg-[#1a1610] border border-[#3a3020] border-l-4 border-l-yellow-600 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#3a3020]">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-semibold tracking-widest uppercase text-yellow-400">
            Theologian Perspective
          </span>
        </div>
        <p className="mt-1.5 text-base font-semibold text-[#e8d5a0]">{name}</p>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {isLoading && !text && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-[#3a3020] rounded w-full" />
            <div className="h-3 bg-[#3a3020] rounded w-5/6" />
            <div className="h-3 bg-[#3a3020] rounded w-full" />
            <div className="h-3 bg-[#3a3020] rounded w-4/6" />
            <div className="h-3 bg-[#3a3020] rounded w-full" />
            <div className="h-3 bg-[#3a3020] rounded w-3/4" />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {text && (
          <div
            className={cn(
              "prose prose-sm max-w-none",
              "prose-p:text-[#c8b880] prose-p:leading-relaxed prose-p:font-serif",
              !isComplete && "cursor-blink"
            )}
            style={{ fontFamily: "var(--font-lora), Georgia, serif" }}
          >
            {text.split("\n\n").map((paragraph, i) => (
              <p key={i} className="text-[#c8b880]">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>

      {isComplete && text && (
        <div className="px-5 pb-3 pt-1">
          <p className="text-xs text-[#666]">
            {text.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>
      )}
    </div>
  );
}
