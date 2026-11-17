import type { MetadataRoute } from "next";
import { listTopics } from "@/lib/topics";

export const revalidate = 3600;

function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const topics = (await listTopics()).filter((t) => !t.slug.startsWith("zz-")); // zz-* are UI fixtures
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...topics.map((t) => {
      const d = new Date(t.generatedAt);
      return {
        url: `${base}/t/${t.slug}`,
        ...(Number.isNaN(d.getTime()) ? {} : { lastModified: d }),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      };
    }),
  ];
}
