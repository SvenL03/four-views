import Link from "next/link";
import { rv } from "@/components/reveal-attrs";

export function SiteFooter() {
  return (
    <footer className="bg-paper-2">
      <div className="wrap pt-16 pb-12 sm:pt-20">
        <p {...rv()} translate="no" className="font-serif font-semibold tracking-[-0.035em] leading-[0.9] text-[clamp(3.5rem,13vw,11rem)]">
          Four Views
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <p className="measure text-ink">
            A reading desk for Christians who want to understand each other. Made by Sven Loeffler,
            host of the Christian Ambition Podcast.
          </p>
          <nav aria-label="Footer" className="ui flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/" className="link inline-flex min-h-11 items-center font-semibold">
              All topics
            </Link>
            <Link href="/about" className="link inline-flex min-h-11 items-center font-semibold">
              How it works
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
