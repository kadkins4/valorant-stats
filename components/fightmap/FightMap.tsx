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
  currentSeasonOf,
  defaultTimeFor,
  minDuelsFor,
  type TimeScope,
  type Layer,
} from "@/lib/fightmap";
import {
  getRegions,
  assignFrags,
  statsFromAssignment,
  issuesFromFlags,
  type RegionIssue,
} from "@/lib/maps/regions";
import { buildRegionModel } from "@/lib/fightmap/regionModel";
import { poolMaps } from "@/lib/maps/pool";
import MapPicker from "./MapPicker";
import Segmented from "./Segmented";
import { DotsGlyph, FlameGlyph } from "./LayerIcons";
import HeatmapUnavailable from "./HeatmapUnavailable";
import OpenerStat from "./OpenerStat";
import { openerStat } from "@/lib/fightmap/openers";
import SideToggle, { type Side } from "./SideToggle";
import TimeSelector from "./TimeSelector";
import RegionView from "./RegionView";
import RegionIssueNotice from "./RegionIssueNotice";
import FragMap from "./FragMap";
import BreakdownTable from "./BreakdownTable";
import { buildRegionRows, buildDuelRows } from "@/lib/fightmap/breakdown";

export default function FightMap({ matches }: { matches: FightMatch[] }) {
  // Only offer competitive-pool maps in the picker.
  const maps = useMemo(() => poolMaps(mapsOf(matches)), [matches]);
  const currentSeason = useMemo(() => currentSeasonOf(matches), [matches]);
  const [map, setMap] = useState(() => {
    // Default to the most-played pool map (this season, then all-time).
    const poolMatches = matches.filter((m) => maps.includes(m.map));
    const inSeason = poolMatches.filter((m) => m.season === currentSeason);
    return (
      mostPlayedMap(inSeason) || mostPlayedMap(poolMatches) || maps[0] || ""
    );
  });
  const [side, setSide] = useState<Side>("both");
  const [time, setTime] = useState<TimeScope>(() => ({ kind: "lastN", n: 5 }));
  const [layer, setLayer] = useState<Layer>("dots");
  const [zoomedRegion, setZoomedRegion] = useState<number | null>(null);
  const [focusedDuel, setFocusedDuel] = useState<number | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [openersOnly, setOpenersOnly] = useState(false);

  // Changing region (or filters, which reset the region) clears the focused duel.
  const goToRegion = (i: number | null) => {
    setZoomedRegion(i);
    setFocusedDuel(null);
  };

  // Switching layer is a mode change: reset the window to that layer's default
  // (Dots and Heatmap want very different sample sizes) and drop to the overview.
  const changeLayer = (l: Layer) => {
    setLayer(l);
    setTime(defaultTimeFor(l, currentSeason));
    goToRegion(null);
  };

  const calib = getCalibration(map);
  const points = useMemo(() => {
    if (!calib) return [];
    return placeDuels(
      collectDuels(matches, { map, side, time, openersOnly }),
      calib,
    );
  }, [matches, map, side, time, openersOnly, calib]);
  const openers = useMemo(() => openerStat(points), [points]);
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
  // Heatmap trusts a zone with fewer duels than Dots (see minDuelsFor).
  const minDuels = minDuelsFor(layer);
  const calloutRegions = useMemo(
    () => assignRegions(points, transformedCallouts, minDuels),
    [points, transformedCallouts, minDuels],
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
      polys.length
        ? statsFromAssignment(points, polys, frags.assignment, minDuels)
        : [],
    [points, polys, frags, minDuels],
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
    () => buildRegionRows(regionModel, assignment, points),
    [regionModel, assignment, points],
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
      {map && (
        <MapPicker
          variant="hero"
          maps={maps}
          value={map}
          onChange={onFilter(setMap)}
        />
      )}
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            VIEW
          </div>
          <Segmented<Layer>
            ariaLabel="Layer"
            variant="mode"
            value={layer}
            onChange={changeLayer}
            options={[
              {
                value: "dots",
                key: "dots",
                label: "Dots",
                icon: <DotsGlyph />,
              },
              {
                value: "heatmap",
                key: "heatmap",
                label: "Heatmap",
                icon: <FlameGlyph />,
                accentIcon: true,
              },
            ]}
          />
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
            {layer === "dots" ? "GAMES" : "RANGE"}
          </div>
          <TimeSelector
            layer={layer}
            currentSeason={currentSeason}
            value={time}
            onChange={onFilter(setTime)}
          />
        </div>
        <div>
          <div
            className="label"
            style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}
          >
            OPENING DUELS
          </div>
          <Segmented<boolean>
            ariaLabel="Opening duels filter"
            value={openersOnly}
            onChange={onFilter(setOpenersOnly)}
            options={[
              { value: false, key: "all", label: "All duels" },
              { value: true, key: "openers", label: "Openers" },
            ]}
          />
        </div>
      </div>

      {!calib ? (
        <p style={{ color: "var(--muted)" }}>
          No minimap calibration for {map} yet.
        </p>
      ) : points.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No duels for this filter — try &ldquo;Last 5 games&rdquo; or a
          different map.
        </p>
      ) : (
        <>
          {polygonMode && (
            <RegionIssueNotice key={map} map={map} issues={issues} />
          )}
          <OpenerStat {...openers} />
          <div>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              {layer === "heatmap" && zoomedRegion == null ? (
                polygonMode ? (
                  <RegionView
                    image={calib.image}
                    mode="polygon"
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
                  <HeatmapUnavailable
                    map={map}
                    onUseDots={() => changeLayer("dots")}
                  />
                )
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
            </div>
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
