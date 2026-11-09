"use client";

import { useState, useCallback } from "react";
import { TopicForm } from "@/components/topic-form";
import { ViewCard } from "@/components/view-card";
import { TheologianCard } from "@/components/theologian-card";
import { AgreementPanel } from "@/components/agreement-panel";
import { SelectedTradition, ViewState, TheologianState, AgreementState } from "@/lib/types";

async function streamSSE(
  url: string,
  options: RequestInit,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      onError(`Request failed: ${res.status}`);
      return;
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        if (raw === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            onError(parsed.error);
            return;
          }
          if (parsed.text) onChunk(parsed.text);
        } catch {
          // ignore parse errors on partial lines
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "Network error");
  }
}

export default function Home() {
  const [topic, setTopic] = useState<string | null>(null);
  const [views, setViews] = useState<ViewState[]>([]);
  const [theologian, setTheologian] = useState<TheologianState | null>(null);
  const [agreement, setAgreement] = useState<AgreementState | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const isLoading = isSelecting || isGenerating;

  const handleSubmit = useCallback(async (topicInput: string, theologianName: string) => {
    setTopic(topicInput);
    setViews([]);
    setTheologian(null);
    setAgreement(null);
    setIsSelecting(true);

    // Phase 1: Select traditions
    let traditions: SelectedTradition[];
    try {
      const res = await fetch(
        `/api/select-traditions?topic=${encodeURIComponent(topicInput)}`
      );
      if (!res.ok) throw new Error("Failed to select traditions");
      const data = await res.json();
      traditions = data.traditions as SelectedTradition[];
    } catch (err) {
      setIsSelecting(false);
      setViews([
        {
          tradition: {
            id: "error",
            name: "Error",
            shortName: "Error",
            description: "",
            accentColor: "border-red-500",
            badgeClass: "bg-red-900/40 text-red-300 border border-red-700/50",
          },
          text: "",
          isLoading: false,
          isComplete: false,
          error: err instanceof Error ? err.message : "Failed to select traditions",
        },
      ]);
      return;
    }

    // Phase 2: Initialize view states and start streaming
    setIsSelecting(false);
    setIsGenerating(true);

    const initialViews: ViewState[] = traditions.map((t) => ({
      tradition: t,
      text: "",
      isLoading: true,
      isComplete: false,
      error: null,
    }));
    setViews(initialViews);

    if (theologianName) {
      setTheologian({
        name: theologianName,
        text: "",
        isLoading: true,
        isComplete: false,
        error: null,
      });
    }

    // Track tradition completions separately to trigger agreement analysis
    const completedTexts: Record<string, string> = {};
    let traditionsDone = 0;

    async function onTraditionComplete(traditionId: string) {
      traditionsDone++;
      if (traditionsDone === traditions.length) {
        setIsGenerating(false);

        // Trigger agreement analysis
        setAgreement({ result: null, isLoading: true, error: null });
        try {
          const viewsPayload = traditions.map((t) => ({
            id: t.id,
            name: t.name,
            text: completedTexts[t.id] ?? "",
          }));
          const res = await fetch("/api/agreement", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: topicInput, views: viewsPayload }),
          });
          if (!res.ok) throw new Error("Agreement API failed");
          const result = await res.json();
          setAgreement({ result, isLoading: false, error: null });
        } catch (err) {
          setAgreement({
            result: null,
            isLoading: false,
            error: err instanceof Error ? err.message : "Agreement analysis failed",
          });
        }
      }
      void traditionId;
    }

    // Stream all four tradition views in parallel
    for (const tradition of traditions) {
      completedTexts[tradition.id] = "";

      streamSSE(
        "/api/views",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topicInput, traditionId: tradition.id }),
        },
        (text) => {
          completedTexts[tradition.id] += text;
          setViews((prev) =>
            prev.map((v) =>
              v.tradition.id === tradition.id ? { ...v, text: v.text + text } : v
            )
          );
        },
        () => {
          setViews((prev) =>
            prev.map((v) =>
              v.tradition.id === tradition.id
                ? { ...v, isLoading: false, isComplete: true }
                : v
            )
          );
          onTraditionComplete(tradition.id);
        },
        (error) => {
          setViews((prev) =>
            prev.map((v) =>
              v.tradition.id === tradition.id ? { ...v, isLoading: false, error } : v
            )
          );
          onTraditionComplete(tradition.id);
        }
      );
    }

    // Stream theologian view in parallel (independent of agreement trigger)
    if (theologianName) {
      streamSSE(
        "/api/theologian",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topicInput, theologianName }),
        },
        (text) => {
          setTheologian((prev) =>
            prev ? { ...prev, text: prev.text + text } : null
          );
        },
        () => {
          setTheologian((prev) =>
            prev ? { ...prev, isLoading: false, isComplete: true } : null
          );
        },
        (error) => {
          setTheologian((prev) =>
            prev ? { ...prev, isLoading: false, error } : null
          );
        }
      );
    }
  }, []);

  const hasResults = views.length > 0;

  return (
    <div className="min-h-screen">
      {hasResults && (
        <header className="sticky top-0 z-10 bg-[#0f0f0f]/90 backdrop-blur border-b border-[#1e1e1e] px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <h1 className="text-sm font-semibold text-[#888] shrink-0 hidden sm:block">
              Four Views
            </h1>
            <div className="flex-1">
              <TopicForm onSubmit={handleSubmit} isLoading={isLoading} compact />
            </div>
          </div>
        </header>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!hasResults && !isSelecting && (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="w-full">
              <TopicForm onSubmit={handleSubmit} isLoading={isLoading} />
            </div>
          </div>
        )}

        {isSelecting && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#333] border-t-[#888] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#888] text-sm">
                Selecting the most relevant traditions for &ldquo;{topic}&rdquo;...
              </p>
            </div>
          </div>
        )}

        {hasResults && (
          <div className="space-y-6">
            <div className="pt-2">
              <p className="text-xs text-[#555] uppercase tracking-widest mb-1">
                Four Views on
              </p>
              <h2 className="text-2xl font-bold text-[#ededed] capitalize">{topic}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {views.map((viewState) => (
                <ViewCard key={viewState.tradition.id} viewState={viewState} />
              ))}
            </div>

            {agreement && <AgreementPanel state={agreement} />}

            {theologian && <TheologianCard state={theologian} />}
          </div>
        )}
      </main>
    </div>
  );
}
