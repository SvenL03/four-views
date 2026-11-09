import { NextRequest, NextResponse } from "next/server";
import { client, MODEL } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { topic, views } = await request.json();
  // views: Array<{ id: string; name: string; text: string }>

  if (!topic || !views || views.length < 2) {
    return NextResponse.json({ error: "Missing topic or views" }, { status: 400 });
  }

  const viewsText = views
    .map((v: { id: string; name: string; text: string }) =>
      `=== ${v.name} ===\n${v.text}`
    )
    .join("\n\n");

  // Build all unique pairs
  const pairNames = [];
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      pairNames.push(`${views[i].id} vs ${views[j].id}`);
    }
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a theologian specializing in comparative theology and ecumenical dialogue. You analyze multiple theological perspectives on a topic and assess the degree of agreement between them on key claims.

For each pair of traditions, score their agreement from 0-100:
- 0-20: Fundamental disagreement — directly contradictory positions
- 21-40: Strong disagreement — share little common ground
- 41-60: Partial agreement — agree on some points, disagree on key issues
- 61-80: Substantial agreement — share most conclusions, differ on details
- 81-100: Near consensus — essentially the same position

Return ONLY valid JSON, no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Topic: "${topic}"

Here are the four theological perspectives:

${viewsText}

Analyze the agreement between every unique pair of traditions. Return JSON in this exact format:
{
  "overallConsensus": <number 0-100, weighted average across all pairs>,
  "summary": "<2 sentences: what they most agree on, and what divides them most sharply>",
  "pairs": [
    {
      "tradition1Id": "<id>",
      "tradition1Name": "<name>",
      "tradition2Id": "<id>",
      "tradition2Name": "<name>",
      "score": <0-100>,
      "note": "<one sentence explaining the key point of agreement or disagreement>"
    }
  ]
}

Include all ${pairNames.length} unique pairs: ${pairNames.join(", ")}.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse agreement analysis" }, { status: 500 });
  }
}
