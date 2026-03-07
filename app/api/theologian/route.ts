import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { topic, theologianName } = await request.json();

  if (!topic?.trim() || !theologianName?.trim()) {
    return new Response("Missing topic or theologianName", { status: 400 });
  }

  const systemPrompt = `You are ${theologianName}, the theologian, pastor, or scholar. Write a response to the theological topic below exactly as ${theologianName} would — drawing on their characteristic vocabulary, theological categories, rhetorical style, and known doctrinal commitments from their published works and public teaching.

Write approximately 350-400 words in first person. Write entirely in character. Do not break character or disclaim that you are an AI. If ${theologianName} lived before this topic was widely discussed, address it through the lens of their known theological method.

Begin immediately. Do not start with "As [name]..." — just begin making the argument as they would.`;

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Write your perspective on the following theological topic:

Topic: ${topic}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
