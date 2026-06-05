import { winRateColor } from "@/lib/fightmap";
import type { OpenerStat as Stat } from "@/lib/fightmap/openers";

// Headline entry-success chip. Renders nothing when there are no opening duels
// in the current scope.
export default function OpenerStat({ won, total, rate }: Stat) {
  if (total === 0) return null;
  const pct = Math.round(rate * 100);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#161b26",
        border: "1px solid #222a38",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#ffd166" }} aria-hidden="true">
        ⚡
      </span>
      <span
        style={{
          color: "var(--muted)",
          fontSize: 11,
          letterSpacing: ".05em",
          textTransform: "uppercase",
        }}
      >
        Opening duels
      </span>
      <b>
        {won}/{total} won
      </b>
      <span style={{ color: winRateColor(rate), fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}
