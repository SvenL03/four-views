import type { CSSProperties } from "react";
import type { TraditionId } from "@/lib/schema";
import { TRADITIONS } from "@/lib/traditions";
import { cn } from "@/lib/utils";

/** Inline style that hands a tradition's hue to the .tr accent classes. */
export function hueStyle(id: TraditionId): CSSProperties {
  return { ["--h" as string]: TRADITIONS[id].hue } as CSSProperties;
}

export function TraditionLabel({
  id,
  short = false,
  className,
}: {
  id: TraditionId;
  short?: boolean;
  className?: string;
}) {
  const t = TRADITIONS[id];
  return (
    <span className={cn("tr inline-flex items-center gap-2", className)} style={hueStyle(id)}>
      <span className="tr-swatch" aria-hidden="true" />
      <span>{short ? t.short : t.name}</span>
    </span>
  );
}

export function TraditionChips({ ids, className }: { ids: TraditionId[]; className?: string }) {
  return (
    <ul className={cn("ui flex flex-wrap gap-2", className)} aria-label="Traditions compared">
      {ids.map((id) => (
        <li
          key={id}
          className="tr tr-tint inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold"
          style={hueStyle(id)}
        >
          <span className="tr-swatch" aria-hidden="true" />
          {TRADITIONS[id].name}
        </li>
      ))}
    </ul>
  );
}
