import { sparklineGeometry } from "@/lib/home/sparkline";

export default function Sparkline({
  values,
  width = 200,
  height = 46,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { points, trend } = sparklineGeometry(values, width, height);
  if (points.length < 2) return null;
  const stroke = trend === "up" ? "var(--green)" : "var(--red)";
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={area} fill={stroke} opacity="0.12" stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}
