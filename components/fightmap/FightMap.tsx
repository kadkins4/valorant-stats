"use client";
import { useMemo, useState } from "react";
import type { FightMatch } from "@/lib/types";
import { getCalibration } from "@/lib/maps/calibration";
import {
  collectDuels,
  placeDuels,
  zonesFromPlaced,
  mapsOf,
  mostPlayedMap,
  seasonsOf,
  currentSeasonOf,
  type TimeScope,
  type Zone,
} from "@/lib/fightmap";
import MapPicker from "./MapPicker";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import ZoneGrid from "./ZoneGrid";
import ZoneDetail from "./ZoneDetail";
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
    kind: "season",
    season: currentSeason,
  }));
  const [selected, setSelected] = useState<Zone | null>(null);

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(collectDuels(matches, { map, side, time }), calib);
  }, [matches, map, side, time, calib]);
  const zones = useMemo(() => zonesFromPlaced(points), [points]);

  // Reset drill-in when filters change the dataset.
  const onFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setSelected(null);
    };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            MAP
          </div>
          <MapPicker maps={maps} value={map} onChange={onFilter(setMap)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            SIDE
          </div>
          <SideToggle value={side} onChange={onFilter(setSide)} />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12 }}
          >
            TIME
          </div>
          <TimeSelector
            seasons={seasons}
            value={time}
            onChange={onFilter(setTime)}
          />
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
