import { NextRequest, NextResponse } from "next/server";
import { client, MODEL } from "@/lib/claude";
import { TRADITION_LIST_FOR_PROMPT, TRADITION_MAP } from "@/lib/tradition-pool";
import { SelectedTradition } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("topic");
  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a theological curriculum designer. Given a theological topic, select the 4 most illuminating and genuinely distinct perspectives from the list provided. Choose traditions that will produce the most interesting contrast and debate on this specific topic. Return ONLY valid JSON — no markdown, no explanation, nothing else.`,
      },
      {
        role: "user",
        content: `Topic: "${topic}"

Available traditions:
${TRADITION_LIST_FOR_PROMPT}

Select the 4 traditions that would produce the most illuminating, genuinely distinct views on this topic. Return JSON in this exact format:
{
  "traditions": ["id1", "id2", "id3", "id4"]
}

Return only the JSON object, nothing else.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let ids: string[];
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    ids = parsed.traditions;
  } catch {
    return NextResponse.json({ error: "Failed to parse tradition selection" }, { status: 500 });
  }

  const selected: SelectedTradition[] = ids
    .filter((id) => TRADITION_MAP[id])
    .slice(0, 4)
    .map((id) => {
      const t = TRADITION_MAP[id];
      return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        description: t.description,
        accentColor: t.accentColor,
        badgeClass: t.badgeClass,
      };
    });

  if (selected.length < 4) {
    const defaults = ["reformed", "arminian", "conservative_evangelical", "mainline_liberal"];
    for (const id of defaults) {
      if (selected.length >= 4) break;
      if (!selected.find((s) => s.id === id) && TRADITION_MAP[id]) {
        const t = TRADITION_MAP[id];
        selected.push({
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          description: t.description,
          accentColor: t.accentColor,
          badgeClass: t.badgeClass,
        });
      }
    }
  }

  return NextResponse.json({ traditions: selected });
}
