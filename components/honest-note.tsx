import { cn } from "@/lib/utils";
import { rv } from "@/components/reveal-attrs";

export function HonestNote({ className, id }: { className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby="honest-note-h" className={cn("bg-paper-3", className)}>
      <div className="wrap grid gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <h2 id="honest-note-h" className="h2" {...rv()}>
          Read the sources, not just us
        </h2>
        <div className="prose-fv measure text-[1.25rem]" {...rv(1)}>
          <p>
            This is a summary to start from, written with AI from each tradition&rsquo;s own
            documents. The sources are the authority, so read them: every claim is numbered and
            linked to the confession, statement or book it comes from.
          </p>
          <p>
            Each view is written the way its own adherents state it, in their vocabulary and at
            their strongest. Four Views doesn&rsquo;t pick a winner.
          </p>
          <p className="ui text-ink-2">Spotted a mistake? Tell us what to fix.</p>
        </div>
      </div>
    </section>
  );
}
