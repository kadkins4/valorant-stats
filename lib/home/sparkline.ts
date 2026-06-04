export type SparklineGeometry = {
  points: [number, number][];
  trend: "up" | "down";
};

// Maps a numeric series to SVG points within [0,w]x[0,h]. Y is flipped so
// higher values sit higher on screen. Flat/degenerate series map to mid-height.
export function sparklineGeometry(
  values: number[],
  w: number,
  h: number,
): SparklineGeometry {
  if (values.length < 2) return { points: [], trend: "up" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i): [number, number] => {
    const x = i * stepX;
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = h - norm * h;
    return [x, y];
  });
  const trend = values[values.length - 1] >= values[0] ? "up" : "down";
  return { points, trend };
}
