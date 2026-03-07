import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";
import { TRADITION_MAP } from "@/lib/tradition-pool";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { topic, traditionId } = await request.json();

  if (!topic?.trim() || !traditionId) {
    return new Response("Missing topic or traditionId", { status: 400 });
  }

  const tradition = TRADITION_MAP[traditionId];
  if (!tradition) {
    return new Response("Unknown tradition", { status: 400 });
  }

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: tradition.systemPrompt,
    messages: [
      {
        role: "user",
        content: `Write your tradition's perspective on the following theological topic for a "Four Views" style academic book:

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
