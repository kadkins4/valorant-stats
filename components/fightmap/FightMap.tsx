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
  zonesFromPlaced,
  assignRegions,
  mapsOf,
  mostPlayedMap,
  seasonsOf,
  currentSeasonOf,
  type TimeScope,
  type Zone,
} from "@/lib/fightmap";
import MapPicker, { chip } from "./MapPicker";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import ZoneGrid from "./ZoneGrid";
import ZoneDetail from "./ZoneDetail";
import RegionView from "./RegionView";
import RegionDetail from "./RegionDetail";
import Legend from "./Legend";

export default function FightMap({ matches }: { matches: FightMatch[] }) {
  const maps = useMemo(() => mapsOf(matches), [matches]);
  const seasons = useMemo(() => seasonsOf(matches), [matches]);
  const currentSeason = useMemo(() => currentSeasonOf(matches), [matches]);
  // Default to the most-played map *within the current season* so the default
  // view (current season) is populated; fall back to overall most-played.
  const [map, setMap] = useState(() => {
    const inSeason = matches.filter((m) => m.season === currentSeason);
    return mostPlayedMap(inSeason) || mostPlayedMap(matches) || maps[0] || "";
  });
  const [side, setSide] = useState<Side>("both");
  const [time, setTime] = useState<TimeScope>(() => ({
    kind: "seasons",
    seasons: [currentSeason],
  }));
  const [selected, setSelected] = useState<Zone | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [view, setView] = useState<"grid" | "regions">("grid");

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(collectDuels(matches, { map, side, time }), calib);
  }, [matches, map, side, time, calib]);
  const zones = useMemo(() => zonesFromPlaced(points), [points]);
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
  const regions = useMemo(
    () => assignRegions(points, transformedCallouts),
    [points, transformedCallouts],
  );

  // Duels whose nearest callout is the selected region, for the drill-in.
  const regionPoints = useMemo(() => {
    if (selectedRegion == null || !transformedCallouts.length) return [];
    return points.filter((p) => {
      let best = 0;
      let bestD = Infinity;
      transformedCallouts.forEach((c, i) => {
        const d = (c.cx - p.nx) ** 2 + (c.cy - p.ny) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best === selectedRegion;
    });
  }, [points, transformedCallouts, selectedRegion]);

  // Reset drill-in when filters change the dataset.
  const onFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setSelected(null);
      setSelectedRegion(null);
    };

  const onView = (v: "grid" | "regions") => {
    setView(v);
    setSelected(null);
    setSelectedRegion(null);
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
            VIEW
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={chip(view === "grid")}
              onClick={() => onView("grid")}
            >
              Grid
            </button>
            <button
              style={chip(view === "regions")}
              onClick={() => onView("regions")}
            >
              Regions
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
      ) : view === "regions" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <RegionView
              image={calib.image}
              regions={regions}
              points={points}
              onSelectRegion={setSelectedRegion}
            />
            <Legend />
          </div>
          {selectedRegion != null && regions[selectedRegion] ? (
            <RegionDetail
              image={calib.image}
              points={regionPoints}
              regionName={regions[selectedRegion].regionName}
            />
          ) : (
            <p style={{ color: "var(--muted)", alignSelf: "center" }}>
              Tap a region to see its individual duels.
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <ZoneGrid
              image={calib.image}
              zones={zones}
              selected={selected}
              onSelect={setSelected}
            />
            <Legend />
          </div>
          {selected ? (
            <ZoneDetail image={calib.image} points={points} zone={selected} />
          ) : (
            <p style={{ color: "var(--muted)", alignSelf: "center" }}>
              Tap a zone to see the individual kills (green) and deaths (red)
              there.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
