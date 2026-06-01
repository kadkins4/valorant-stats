import calibrations from "./calibration.json";

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
