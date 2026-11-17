import type { CSSProperties } from "react";

/** Props for a block that rises into view; `step` staggers it by 70ms. */
export function rv(step = 0, style?: CSSProperties) {
  return {
    "data-reveal": "",
    style: { ...(style ?? {}), ["--d" as string]: `${Math.min(step, 6) * 70}ms` } as CSSProperties,
  };
}
