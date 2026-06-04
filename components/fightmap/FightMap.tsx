"use client";
import { useMemo, useState } from "react";
import type { FightMatch } from "@/lib/types";
import {
  getCalibration,
  getCallouts,
  transformCoord,
} from "@/lib/maps/calibration";
import {
  collectDuels,
  placeDuels,
  assignRegions,
  mapsOf,
  mostPlayedMap,
  seasonsOf,
  currentSeasonOf,
  type TimeScope,
} from "@/lib/fightmap";
import {
  getRegions,
  assignFrags,
  statsFromAssignment,
  issuesFromFlags,
  type RegionIssue,
} from "@/lib/maps/regions";
import { buildRegionModel } from "@/lib/fightmap/regionModel";
import MapPicker, { chip } from "./MapPicker";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import RegionView from "./RegionView";
import RegionIssueNotice from "./RegionIssueNotice";
import FragMap from "./FragMap";
import Legend from "./Legend";
import BreakdownTable from "./BreakdownTable";
import { buildRegionRows, buildDuelRows } from "@/lib/fightmap/breakdown";

export default function FightMap({ matches }: { matches: FightMatch[] }) {
  const maps = useMemo(() => mapsOf(matches), [matches]);
  const seasons = useMemo(() => seasonsOf(matches), [matches]);
  const currentSeason = useMemo(() => currentSeasonOf(matches), [matches]);
  const [map, setMap] = useState(() => {
    const inSeason = matches.filter((m) => m.season === currentSeason);
    return mostPlayedMap(inSeason) || mostPlayedMap(matches) || maps[0] || "";
  });
  const [side, setSide] = useState<Side>("both");
  const [time, setTime] = useState<TimeScope>(() => ({
    kind: "seasons",
    seasons: [currentSeason],
  }));
  const [layer, setLayer] = useState<"dots" | "heatmap">("dots");
  const [zoomedRegion, setZoomedRegion] = useState<number | null>(null);
  const [focusedDuel, setFocusedDuel] = useState<number | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(true);

  // Changing region (or filters, which reset the region) clears the focused duel.
  const goToRegion = (i: number | null) => {
    setZoomedRegion(i);
    setFocusedDuel(null);
  };

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(collectDuels(matches, { map, side, time }), calib);
  }, [matches, map, side, time, calib]);
  const transformedCallouts = useMemo(() => {
    if (!calib) return [];
    return getCallouts(map).map((c) => {
      const t = transformCoord(calib, c);
      return {
        regionName: c.regionName,
        superRegionName: c.superRegionName,
        cx: t.nx,
        cy: t.ny,
      };
    });
  }, [map, calib]);
  const calloutRegions = useMemo(
    () => assignRegions(points, transformedCallouts),
    [points, transformedCallouts],
  );

  const polys = useMemo(() => getRegions(map), [map]);
  const frags = useMemo(
    () =>
      polys.length
        ? assignFrags(points, polys)
        : { assignment: [] as number[], flags: [] },
    [points, polys],
  );
  const polyStats = useMemo(
    () =>
      polys.length ? statsFromAssignment(points, polys, frags.assignment) : [],
    [points, polys, frags],
  );
  const issues = useMemo<RegionIssue[]>(
    () =>
      polys.length ? issuesFromFlags(map, points, polys, frags.flags) : [],
    [map, points, polys, frags],
  );
  const polygonMode = polys.length > 0;

  const { regions: regionModel, assignment } = useMemo(
    () => buildRegionModel(points, polyStats, calloutRegions, frags.assignment),
    [points, polyStats, calloutRegions, frags.assignment],
  );

  const regionRows = useMemo(
    () => buildRegionRows(regionModel, assignment),
    [regionModel, assignment],
  );
  const zoomedDuels = useMemo(
    () =>
      zoomedRegion == null
        ? []
        : points.filter((_, i) => assignment[i] === zoomedRegion),
    [points, assignment, zoomedRegion],
  );
  const duelRows = useMemo(() => buildDuelRows(zoomedDuels), [zoomedDuels]);

  // Filters change the dataset (and region indices) — drop back to the overview.
  const onFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      goToRegion(null);
    };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            MAP
          </div>
          <MapPicker maps={maps} value={map} onChange={onFilter(setMap)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            SIDE
          </div>
          <SideToggle value={side} onChange={onFilter(setSide)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            SEASONS
          </div>
          <TimeSelector
            seasons={seasons}
            value={time}
            onChange={onFilter(setTime)}
          />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            LAYER
          </div>
          <div
            role="group"
            aria-label="Layer"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <button
              type="button"
              aria-pressed={layer === "dots"}
              style={chip(layer === "dots")}
              onClick={() => setLayer("dots")}
            >
              Dots
            </button>
            <button
              type="button"
              aria-pressed={layer === "heatmap"}
              style={chip(layer === "heatmap")}
              onClick={() => {
                setLayer("heatmap");
                goToRegion(null);
              }}
            >
              Heatmap
            </button>
          </div>
        </div>
      </div>

      {!calib ? (
        <p style={{ color: "var(--muted)" }}>
          No minimap calibration for {map} yet.
        </p>
      ) : points.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No duels for this filter — try &ldquo;All time&rdquo; or a different
          map.
        </p>
      ) : (
        <>
          {polygonMode && (
            <RegionIssueNotice key={map} map={map} issues={issues} />
          )}
          <div>
            {layer === "heatmap" && zoomedRegion == null ? (
              <RegionView
                image={calib.image}
                mode={polygonMode ? "polygon" : "raster"}
                regions={calloutRegions}
                polyRegions={polyStats}
                points={points}
                selected={null}
                onSelectRegion={(i) => {
                  goToRegion(i);
                  setLayer("dots");
                }}
              />
            ) : (
              <FragMap
                image={calib.image}
                points={points}
                regions={regionModel}
                assignment={assignment}
                zoomedRegion={zoomedRegion}
                onZoom={(ri) => goToRegion(ri)}
                onExitZoom={() => goToRegion(null)}
                focusedDuel={focusedDuel}
                onFocusDuel={setFocusedDuel}
              />
            )}
            <Legend />
            <BreakdownTable
              expanded={breakdownOpen}
              onToggle={() => setBreakdownOpen((o) => !o)}
              regionRows={zoomedRegion == null ? regionRows : undefined}
              onSelectRegion={(i) => {
                goToRegion(i);
                setLayer("dots");
              }}
              duelRows={zoomedRegion == null ? undefined : duelRows}
              regionName={
                zoomedRegion == null
                  ? undefined
                  : (regionModel[zoomedRegion]?.name ?? "Region")
              }
              focusedDuel={focusedDuel}
              onSelectDuel={setFocusedDuel}
            />
          </div>
        </>
      )}
    </div>
  );
}
