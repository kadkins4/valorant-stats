"use client";

import { useState } from "react";
import { mapListIcon } from "@/lib/maps/calibration";
import styles from "./MapPicker.module.css";

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px",
  borderRadius: 14,
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  cursor: "pointer",
  border: "none",
  background: active ? "var(--accent)" : "#222a38",
  color: active ? "#fff" : "#aeb6c6",
  transition: "background 0.15s",
});

export default function MapPicker({
  maps,
  value,
  onChange,
}: {
  maps: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  // Maps whose banner image failed to load — fall back to a text chip.
  const [failed, setFailed] = useState<Set<string>>(new Set());

  return (
    <div className={styles.row}>
      {maps.map((m) => {
        const active = m === value;
        const url = mapListIcon(m);

        if (!url || failed.has(m)) {
          return (
            <button
              key={m}
              aria-pressed={active}
              style={chip(active)}
              onClick={() => onChange(m)}
            >
              {m}
            </button>
          );
        }

        return (
          <button
            key={m}
            aria-pressed={active}
            className={`${styles.tile} ${active ? styles.active : ""}`}
            onClick={() => onChange(m)}
          >
            <img
              className={styles.img}
              src={url}
              alt=""
              loading="lazy"
              onError={() => setFailed((prev) => new Set(prev).add(m))}
            />
            <span className={styles.cap}>{m}</span>
          </button>
        );
      })}
    </div>
  );
}

export { chip };
