import { Fragment, type ReactNode } from "react";

// one or more adjacent markers: [1], [1, 3], [2-4], [1][3]
const MARK = /(?:\s*\[\d+(?:\s*[,–-]\s*\d+)*\])+/g;

function expand(group: string): number[] {
  const out: number[] = [];
  for (const part of group.split(/\s*,\s*/)) {
    const range = part.split(/\s*[–-]\s*/).map(Number);
    if (range.length === 2 && range[0] < range[1] && range[1] - range[0] < 10) {
      for (let n = range[0]; n <= range[1]; n++) out.push(n);
    } else if (!Number.isNaN(range[0])) {
      out.push(range[0]);
    }
  }
  return out;
}

/**
 * Renders prose with [n] markers as superscript links to the view's numbered
 * source list (#src-{anchor}-{n}). Markers pointing past the list stay as text.
 */
export function CitedText({
  text,
  anchor,
  sourceCount,
  sourceTitles,
}: {
  text: string;
  anchor: string;
  sourceCount: number;
  sourceTitles?: string[];
}) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(MARK)) {
    const idx = m.index ?? 0;
    // drop the space a writer puts before a marker
    nodes.push(<Fragment key={key++}>{text.slice(last, idx)}</Fragment>);
    const groups = [...m[0].matchAll(/\[([^\]]+)\]/g)].map((g) => g[1]);
    const nums = [...new Set(groups.flatMap(expand))];
    nodes.push(
      <sup key={key++} className="cite">
        {nums.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && <span aria-hidden="true">,</span>}
            {n >= 1 && n <= sourceCount ? (
              <a
                href={`#src-${anchor}-${n}`}
                aria-label={`Source ${n}${sourceTitles?.[n - 1] ? `: ${sourceTitles[n - 1]}` : ""}`}
              >
                {n}
              </a>
            ) : (
              <span>{n}</span>
            )}
          </Fragment>
        ))}
      </sup>,
    );
    last = idx + m[0].length;
  }
  nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}
