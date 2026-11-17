// Share image for a topic: "Four Views on", the title, the question and the
// four traditions in their accent colours. Satori can't read oklch(), so the
// accents are converted to hex here with the same L/C the site uses.
import { ImageResponse } from "next/og";
import { getTopic } from "@/lib/topics";
import { TRADITIONS } from "@/lib/traditions";

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
const LINE = oklch(0.88, 0.006, 95);

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = await getTopic(slug);
  const title = clip(topic?.title ?? "A question of faith", 70);
  const question = topic ? clip(topic.question, 170) : "One question, four Christian traditions, each in its own words.";
  const ids = topic?.traditionIds ?? [];
  const titleSize = title.length > 40 ? 60 : title.length > 22 ? 72 : 88;

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
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: INK_2 }}>
            Four Views on
          </div>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, marginTop: 18 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.3, color: INK_2, marginTop: 24, maxWidth: 1000 }}>
            {question}
          </div>
        </div>
        {ids.length > 0 ? (
          <div style={{ display: "flex", gap: 24, borderTop: `2px solid ${LINE}`, paddingTop: 28 }}>
            {ids.map((id) => {
              const t = TRADITIONS[id];
              return (
                <div key={id} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", height: 10, borderRadius: 5, background: oklch(0.62, 0.12, t.hue) }} />
                  <div style={{ display: "flex", fontSize: 28, fontWeight: 700, marginTop: 14, color: oklch(0.5, 0.1, t.hue) }}>
                    {t.short}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 28, color: INK_2 }}>Four Views</div>
        )}
      </div>
    ),
    size,
  );
}
