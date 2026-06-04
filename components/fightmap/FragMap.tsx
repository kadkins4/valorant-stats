"use client";
import { useEffect } from "react";
import type { Placed } from "@/lib/fightmap";
import type { RegionModel } from "@/lib/fightmap/regionModel";
import { regionBounds, FULL_VIEWBOX } from "@/lib/fightmap/zoom";
import { useAnimatedViewBox } from "./useAnimatedViewBox";
import DuelMap from "./DuelMap";

export default function FragMap({
  image,
  points,
  regions,
  assignment,
  zoomedRegion,
  onZoom,
  onExitZoom,
}: {
  image: string;
  points: Placed[];
  regions: RegionModel[];
  assignment: number[];
  zoomedRegion: number | null;
  onZoom: (regionIndex: number) => void;
  onExitZoom: () => void;
}) {
  // Esc exits the zoom.
  useEffect(() => {
    if (zoomedRegion == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExitZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedRegion, onExitZoom]);

  const zoomed = zoomedRegion != null;
  const shownPoints = zoomed
    ? points.filter((_, i) => assignment[i] === zoomedRegion)
    : points;
  const target = zoomed
    ? regionBounds(regions[zoomedRegion]?.polygon ?? null, shownPoints)
    : FULL_VIEWBOX;
  const { vb, animating } = useAnimatedViewBox(target);

  return (
    <div data-animating={animating ? "true" : "false"}>
      {zoomed && (
        <button
          type="button"
          onClick={onExitZoom}
          style={{
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            background: "transparent",
            border: "none",
            color: "#ffd166",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 0",
            marginBottom: 6,
          }}
        >
          ◀ All regions /{" "}
          <b style={{ color: "#ece8e1" }}>
            {regions[zoomedRegion]?.name ?? "Region"}
          </b>
        </button>
      )}
      <DuelMap
        image={image}
        points={shownPoints}
        viewBox={vb}
        onZoom={
          zoomed
            ? undefined
            : (i) => {
                const ri = assignment[i];
                if (ri !== -1) onZoom(ri); // ignore points with no region
              }
        }
      />
    </div>
  );
}
