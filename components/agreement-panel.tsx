"use client";

import { AgreementState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgreementPanelProps {
  state: AgreementState;
}

function scoreColor(score: number) {
  if (score >= 61) return { bar: "bg-emerald-500", text: "text-emerald-400", label: "Strong agreement" };
  if (score >= 41) return { bar: "bg-amber-500", text: "text-amber-400", label: "Partial agreement" };
  if (score >= 21) return { bar: "bg-orange-500", text: "text-orange-400", label: "Strong disagreement" };
  return { bar: "bg-red-500", text: "text-red-400", label: "Fundamental disagreement" };
}

function consensusColor(score: number) {
  if (score >= 61) return "text-emerald-400";
  if (score >= 41) return "text-amber-400";
  if (score >= 21) return "text-orange-400";
  return "text-red-400";
}

export function AgreementPanel({ state }: AgreementPanelProps) {
  const { result, isLoading, error } = state;

  return (
    <div className="rounded-lg bg-[#141414] border border-[#252525] overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-[#252525] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#555] mb-1">
            Consensus Analysis
          </p>
          <p className="text-sm text-[#888]">
            How much do these traditions agree?
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-[#555] text-sm">
            <div className="w-4 h-4 border border-[#333] border-t-[#666] rounded-full animate-spin" />
            Analyzing...
          </div>
        )}

        {result && (
          <div className="text-right">
            <p className={cn("text-4xl font-bold tabular-nums", consensusColor(result.overallConsensus))}>
              {result.overallConsensus}%
            </p>
            <p className="text-xs text-[#555] mt-0.5">overall consensus</p>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 py-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="px-5 py-5 space-y-5">
          {/* Summary */}
          <p className="text-sm text-[#aaa] leading-relaxed italic border-l-2 border-[#333] pl-3">
            {result.summary}
          </p>

          {/* Pairwise scores */}
          <div className="space-y-3">
            {result.pairs.map((pair, i) => {
              const colors = scoreColor(pair.score);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-[#ccc] shrink-0">
                        {pair.tradition1Name}
                      </span>
                      <span className="text-[#444] text-xs">vs</span>
                      <span className="text-xs font-medium text-[#ccc] shrink-0">
                        {pair.tradition2Name}
                      </span>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums shrink-0", colors.text)}>
                      {pair.score}%
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
                      style={{ width: `${pair.score}%` }}
                    />
                  </div>

                  {/* Note */}
                  <p className="text-xs text-[#666] leading-relaxed">{pair.note}</p>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-2 border-t border-[#1e1e1e] flex flex-wrap gap-x-4 gap-y-1">
            {[
              { range: "0–20", label: "Fundamental disagreement", color: "bg-red-500" },
              { range: "21–40", label: "Strong disagreement", color: "bg-orange-500" },
              { range: "41–60", label: "Partial agreement", color: "bg-amber-500" },
              { range: "61–100", label: "Strong agreement", color: "bg-emerald-500" },
            ].map((item) => (
              <div key={item.range} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full shrink-0", item.color)} />
                <span className="text-xs text-[#555]">{item.range} — {item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
