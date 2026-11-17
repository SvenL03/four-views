// GET /api/topics/{slug} -> GetTopicResponse. Pages poll this while a topic is pending.
import { NextResponse } from "next/server";
import type { GetTopicResponse } from "@/lib/api-contract";
import { getTopicStatus } from "@/lib/topics";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: GetTopicResponse;
  try {
    body = await getTopicStatus(slug);
  } catch (e) {
    console.error("[api/topics/slug] read failed:", e);
    body = { status: "error", message: "We couldn't load this topic just now. Please try again." };
  }
  const cache =
    body.status === "ready" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store";
  return NextResponse.json(body, {
    status: body.status === "missing" ? 404 : 200,
    headers: { "Cache-Control": cache },
  });
}
