"use client";
import { useEffect, useState } from "react";

function ago(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function untilNextHour(now: number) {
  const next = new Date(now);
  next.setMinutes(60, 0, 0); // rolls to the top of the next hour
  const mins = Math.max(0, Math.round((next.getTime() - now) / 60000));
  return mins <= 1 ? "any minute" : `~${mins}m`;
}

// Sync runs hourly (top of each hour UTC). This badge only *displays* freshness;
// it doesn't fetch. Gated on a client-side `now` so SSR and hydration match.
export default function RefreshBadge({
  updatedAt,
}: {
  updatedAt: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const seed = setTimeout(tick, 0); // defer initial set out of the effect body
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, []);

  if (!updatedAt || now === null) return null;

  return (
    <span
      title="Data auto-refreshes hourly. Timing is approximate — GitHub can delay scheduled runs."
      style={{
        marginLeft: "auto",
        fontSize: 12,
        opacity: 0.7,
        whiteSpace: "nowrap",
      }}
    >
      Updated {ago(now - new Date(updatedAt).getTime())} · next refresh{" "}
      {untilNextHour(now)}
    </span>
  );
}
