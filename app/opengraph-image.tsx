// Share image for the home page. Satori can't read oklch(), so accents are
// converted to hex here with the same L/C the site uses.
import { ImageResponse } from "next/og";
import { activeTraditions } from "@/lib/traditions";

export const alt = "Four Views: one theological question answered by four Christian traditions, each in its own words";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** OKLCH -> sRGB hex (gamut-clipped). */
function oklch(l: number, c: number, hue: number): string {
  const h = (hue * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    rgb
      .map((x) => {
        const v = Math.min(1, Math.max(0, x));
        const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(g * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

const PAPER = oklch(0.985, 0.002, 95);
const INK = oklch(0.2, 0.012, 260);
const INK_2 = oklch(0.42, 0.012, 260);

export default function Image() {
  const traditions = activeTraditions();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: "72px 72px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 700, lineHeight: 1 }}>Four Views</div>
          <div style={{ display: "flex", fontSize: 40, lineHeight: 1.3, color: INK_2, marginTop: 28, maxWidth: 900 }}>
            One theological question, four Christian traditions, each in its own words and sources.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {traditions.map((t) => (
            <div key={t.id} style={{ display: "flex", flex: 1, height: 14, borderRadius: 7, background: oklch(0.62, 0.12, t.hue) }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
