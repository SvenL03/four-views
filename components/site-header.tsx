import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="wrap flex items-center justify-between gap-4 py-4 sm:py-5">
      <Link
        href="/"
        className="font-serif text-[1.375rem] font-semibold tracking-[-0.02em] leading-none py-2"
      >
        Four Views
      </Link>
      <nav aria-label="Site" className="ui flex items-center gap-1 sm:gap-2">
        <Link href="/#topics" className="link inline-flex min-h-11 items-center px-3 font-semibold">
          Topics
        </Link>
        <Link href="/about" className="link inline-flex min-h-11 items-center px-3 font-semibold">
          How it works
        </Link>
      </nav>
    </header>
  );
}
