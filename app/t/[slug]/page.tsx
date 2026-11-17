import type { Metadata } from "next";
import { getTopic, listTopics } from "@/lib/topics";
import { TopicArticle } from "@/components/topic/topic-article";
import { TopicPending } from "@/components/topic/topic-pending";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopic(slug);
  if (!topic) {
    return {
      title: "Four Views",
      robots: { index: false, follow: true },
    };
  }
  const title = /[?!]$/.test(topic.title) ? `${topic.title} Four Christian views` : `${topic.title}: four Christian views`;
  return {
    title,
    description: topic.question,
    alternates: { canonical: `/t/${topic.slug}` },
    openGraph: {
      title,
      description: topic.question,
      url: `/t/${topic.slug}`,
      siteName: "Four Views",
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description: topic.question },
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = await getTopic(slug);
  if (!topic) {
    const written = (await listTopics()).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 8);
    return <TopicPending slug={slug} written={written} />;
  }
  return <TopicArticle topic={topic} />;
}
