"use client";

import { useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicFormProps {
  onSubmit: (topic: string, theologianName: string) => void;
  isLoading: boolean;
  compact?: boolean;
}

const EXAMPLE_TOPICS = [
  "predestination",
  "baptism",
  "the atonement",
  "spiritual gifts",
  "biblical inerrancy",
  "the prosperity gospel",
  "hell and eternal punishment",
  "sanctification",
];

export function TopicForm({ onSubmit, isLoading, compact = false }: TopicFormProps) {
  const [topic, setTopic] = useState("");
  const [theologianName, setTheologianName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;
    onSubmit(topic.trim(), theologianName.trim());
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a theological topic..."
          className="flex-1 min-w-48 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-sm text-[#ededed] placeholder-[#555] focus:outline-none focus:border-[#555] transition-colors"
          disabled={isLoading}
        />
        <input
          type="text"
          value={theologianName}
          onChange={(e) => setTheologianName(e.target.value)}
          placeholder="Theologian (optional)"
          className="w-52 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 text-sm text-[#ededed] placeholder-[#555] focus:outline-none focus:border-[#555] transition-colors"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            "bg-[#ededed] text-[#0f0f0f] hover:bg-white",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isLoading ? "Generating..." : "Generate"}
        </button>
      </form>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-5">
          <BookOpen className="w-7 h-7 text-[#888]" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#ededed] mb-3">
          Four Views
        </h1>
        <p className="text-[#888] text-lg leading-relaxed">
          Enter any theological topic and explore four distinct American Christian perspectives — chosen by AI based on the topic.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#aaa]">Theological Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., predestination, baptism, the atonement..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-[#ededed] placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors text-base"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#aaa]">
            Specific Theologian{" "}
            <span className="text-[#555] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={theologianName}
            onChange={(e) => setTheologianName(e.target.value)}
            placeholder="e.g., John Piper, N.T. Wright, Thomas Aquinas..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-[#ededed] placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors text-base"
            disabled={isLoading}
          />
          <p className="text-xs text-[#555]">
            Get a fifth perspective written in this person&apos;s theological voice.
          </p>
        </div>

        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all text-base",
            "bg-[#ededed] text-[#0f0f0f] hover:bg-white",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Selecting traditions & generating views...
            </>
          ) : (
            <>
              <BookOpen className="w-5 h-5" />
              Generate Four Views
            </>
          )}
        </button>
      </form>

      {/* Example topics */}
      <div className="mt-8">
        <p className="text-xs text-[#555] mb-3 text-center">Try a topic:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="text-xs px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-[#ccc] hover:border-[#444] transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
