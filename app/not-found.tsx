import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap pt-10 pb-28 sm:pt-16 sm:pb-40">
      <h1 className="title max-w-[14ch]">This page isn&rsquo;t here</h1>
      <p className="statement mt-10 max-w-[36rem]">
        The link may be old, or the topic may have a different name.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/#topics" className="btn">
          See all topics
        </Link>
        <Link href="/about" className="btn btn-quiet">
          How Four Views works
        </Link>
      </div>
    </div>
  );
}
