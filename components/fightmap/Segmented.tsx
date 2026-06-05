"use client";
import styles from "./Segmented.module.css";

export type SegOption<T> = {
  value: T;
  label: React.ReactNode;
  key?: string | number;
};

// A reusable inset segmented control for a mutually-exclusive set of options.
// Values are compared with ===, so use it with primitive values (map an object
// state down to a primitive key before passing it in). The "mode" variant is a
// larger, status-dot styling for a top-level view switch (vs a filter).
export default function Segmented<T>({
  value,
  options,
  onChange,
  ariaLabel,
  variant = "segment",
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  variant?: "segment" | "mode";
}) {
  const mode = variant === "mode";
  const cls = {
    seg: mode ? styles.modeSeg : styles.seg,
    opt: mode ? styles.modeOpt : styles.opt,
    on: mode ? styles.modeOn : styles.on,
  };
  return (
    <div className={cls.seg} role="group" aria-label={ariaLabel}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.key ?? i}
            type="button"
            aria-pressed={active}
            className={`${cls.opt} ${active ? cls.on : ""}`}
            onClick={() => onChange(o.value)}
          >
            {mode && <span className={styles.dot} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
