import calibrations from "./calibration.json";
import calloutData from "./callouts.json";

export interface MapCalibration {
  name: string;
  image: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
}

const ALL = calibrations as MapCalibration[];

export function getCalibration(map: string): MapCalibration | undefined {
  const key = map.toLowerCase();
  return ALL.find((c) => c.name.toLowerCase() === key);
}

// The photographic banner (Riot's listViewIcon) lives at the same map UUID as
// the displayicon used for calibration — derive it, no extra data needed. It's
// small (≈456×100), so use it only for thumbnails; use mapSplash for the hero.
export function mapListIcon(map: string): string | null {
  const cal = getCalibration(map);
  if (!cal) return null;
  return cal.image.replace("displayicon", "listviewicon");
}

// High-res splash art (1920×1080) for the hero banner — same scenic view as the
// listViewIcon but crisp at large sizes.
export function mapSplash(map: string): string | null {
  const cal = getCalibration(map);
  if (!cal) return null;
  return cal.image.replace("displayicon", "splash");
}

// All map names that have calibration data.
export function calibratedMaps(): string[] {
  return ALL.map((c) => c.name);
}

export interface Callout {
  regionName: string;
  superRegionName: string;
  x: number;
  y: number;
}

const CALLOUTS = calloutData as { map: string; callouts: Callout[] }[];

export function getCallouts(map: string): Callout[] {
  const key = map.toLowerCase();
  return CALLOUTS.find((c) => c.map.toLowerCase() === key)?.callouts ?? [];
}

// Valorant minimap transform. Game (x,y) -> normalized [0,1] over displayIcon.
// Note the x/y swap; this is the documented community formula.
export function transformCoord(
  c: MapCalibration,
  loc: { x: number; y: number },
): { nx: number; ny: number } {
  return {
    nx: loc.y * c.xMultiplier + c.xScalarToAdd,
    ny: loc.x * c.yMultiplier + c.yScalarToAdd,
  };
}
