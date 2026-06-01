"use client";
import { winRateColor, type Placed, type RegionStat } from "@/lib/fightmap";

const RASTER_N = 80; // tiles per axis — finer raster for tighter blobs
// Max normalized distance from a cell center to the nearest real duel for the
// cell to be shaded. Cells farther than this stay transparent, so the colored
// blobs hug where fights actually happen instead of tiling the whole minimap.
// Tighter than a callout Voronoi can be — this is the ceiling of point data.
const MASK_R = 0.04;
const MASK_R2 = MASK_R * MASK_R;

export default function RegionView({
  image,
  regions,
  points,
  onSelectRegion,
}: {
  image: string;
  regions: RegionStat[];
  points: Placed[];
  onSelectRegion: (index: number) => void;
}) {
  const cell = 100 / RASTER_N; // percent units in a 0..100 viewBox
  const tiles: { x: number; y: number; r: RegionStat }[] = [];
  if (regions.length && points.length) {
    // Tag each duel with its region (nearest callout) once, so cells can be
    // colored by the region of the *nearest real duel* rather than the nearest
    // callout point. This keeps color tightly coupled to actual fight data and
    // cuts the cross-region bleed you get from a pure callout Voronoi.
    const pointRegion = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < regions.length; i++) {
        const d = (regions[i].cx - p.nx) ** 2 + (regions[i].cy - p.ny) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    });

    for (let row = 0; row < RASTER_N; row++) {
      for (let col = 0; col < RASTER_N; col++) {
        // cell center in normalized [0,1]
        const cnx = (col + 0.5) / RASTER_N;
        const cny = (row + 0.5) / RASTER_N;

        // Find the nearest real duel to this cell.
        let nearestD = Infinity;
        let nearestI = -1;
        for (let k = 0; k < points.length; k++) {
          const d = (points[k].nx - cnx) ** 2 + (points[k].ny - cny) ** 2;
          if (d < nearestD) {
            nearestD = d;
            nearestI = k;
          }
        }
        // Mask: skip cells with no real duel within MASK_R.
        if (nearestI < 0 || nearestD > MASK_R2) continue;

        // Color by the region of that nearest duel.
        tiles.push({
          x: col * cell,
          y: row * cell,
          r: regions[pointRegion[nearestI]],
        });
      }
    }
  }

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    const nx = clickX / 100;
    const ny = clickY / 100;
    let best = -1;
    let bestD = Infinity;
    regions.forEach((r, i) => {
      if (r.muted) return;
      const d = (r.cx - nx) ** 2 + (r.cy - ny) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) onSelectRegion(best);
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      onClick={handleClick}
      style={{
        display: "block",
        borderRadius: 10,
        border: "1px solid #222a38",
        aspectRatio: "1 / 1",
        cursor: "pointer",
      }}
    >
      <image
        href={image}
        x="0"
        y="0"
        width="100"
        height="100"
        opacity="0.5"
        preserveAspectRatio="xMidYMid slice"
      />
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width={cell}
          height={cell}
          fill={t.r.muted ? "#3a3f4b" : winRateColor(t.r.winRate)}
          opacity={t.r.muted ? 0.25 : 0.6}
        />
      ))}
      {regions.map((r, i) =>
        r.muted ? null : (
          <g key={i} style={{ pointerEvents: "none" }}>
            <text
              x={r.cx * 100}
              y={r.cy * 100}
              textAnchor="middle"
              fontSize="2.2"
              fontWeight="700"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.4"
              style={{ paintOrder: "stroke" }}
            >
              {r.regionName}
            </text>
            <text
              x={r.cx * 100}
              y={r.cy * 100 + 2.6}
              textAnchor="middle"
              fontSize="1.9"
              fontWeight="600"
              fill="#fff"
              stroke="#11151d"
              strokeWidth="0.35"
              style={{ paintOrder: "stroke" }}
            >
              {Math.round(r.winRate * 100)}% · {r.total}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}
