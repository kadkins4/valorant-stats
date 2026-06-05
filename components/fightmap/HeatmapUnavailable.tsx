"use client";
import { FlameGlyph } from "./LayerIcons";

// Shown in the heatmap slot for maps whose regions haven't been traced yet, so
// there's no heatmap to draw. Offers a one-click switch to the Dots view.
export default function HeatmapUnavailable({
  map,
  onUseDots,
}: {
  map: string;
  onUseDots: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        aspectRatio: "1 / 1",
        padding: 24,
        borderRadius: 10,
        border: "1px dashed #2a3340",
        background: "#0c0f15",
        color: "#aeb6c6",
      }}
    >
      <span
        style={{
          color: "#3a4256",
          display: "inline-flex",
          transform: "scale(2.4)",
          marginBottom: 8,
        }}
      >
        <FlameGlyph />
      </span>
      <strong style={{ color: "#ece8e1", fontSize: 15 }}>
        No heatmap for {map} yet
      </strong>
      <span style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
        This map&rsquo;s regions haven&rsquo;t been mapped, so there&rsquo;s no
        heatmap to show. Switch to Dots to see individual duels.
      </span>
      <button
        type="button"
        onClick={onUseDots}
        style={{
          marginTop: 4,
          padding: "7px 16px",
          borderRadius: 10,
          border: "1px solid #34405a",
          background: "#1d2533",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Switch to Dots
      </button>
    </div>
  );
}
