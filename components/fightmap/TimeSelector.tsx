"use client";
import Segmented from "./Segmented";
import {
  timeOptionsFor,
  timeScopeKey,
  type Layer,
  type TimeScope,
} from "@/lib/fightmap";

// The available windows depend on the layer: Dots stays to a few recent games,
// Heatmap opens up to all-time. See timeOptionsFor in lib/fightmap.
export default function TimeSelector({
  layer,
  currentSeason,
  value,
  onChange,
}: {
  layer: Layer;
  currentSeason: string;
  value: TimeScope;
  onChange: (t: TimeScope) => void;
}) {
  const options = timeOptionsFor(layer, currentSeason);
  const current = timeScopeKey(value);
  return (
    <Segmented<string>
      ariaLabel="Sample size"
      value={current}
      onChange={(key) => {
        const opt = options.find((o) => o.key === key);
        if (opt) onChange(opt.scope);
      }}
      options={options.map((o) => ({
        value: o.key,
        key: o.key,
        label: o.label,
      }))}
    />
  );
}
