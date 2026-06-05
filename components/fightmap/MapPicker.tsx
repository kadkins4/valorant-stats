"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  // Map banners that failed to load — fall back to a name-only row.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markFailed = (m: string) => setFailed((prev) => new Set(prev).add(m));

  const triggerUrl = mapListIcon(value);
  const sorted = [...maps].sort((a, b) => a.localeCompare(b));

  return (
    <div className={styles.dd} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Map: ${value || "select a map"}`}
        onClick={() => setOpen((o) => !o)}
      >
        {triggerUrl && !failed.has(value) && (
          <img
            className={styles.triggerThumb}
            src={triggerUrl}
            alt=""
            onError={() => markFailed(value)}
          />
        )}
        <span>{value || "Select map"}</span>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul className={styles.panel} role="listbox" aria-label="Map">
          {sorted.map((m) => {
            const active = m === value;
            const url = mapListIcon(m);
            return (
              <li key={m} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`${styles.row} ${active ? styles.rowOn : ""}`}
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                >
                  {url && !failed.has(m) && (
                    <img
                      className={styles.rowThumb}
                      src={url}
                      alt=""
                      loading="lazy"
                      onError={() => markFailed(m)}
                    />
                  )}
                  <span>{m}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { chip };
