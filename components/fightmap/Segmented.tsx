"use client";
import styles from "./Segmented.module.css";

export type SegOption<T> = {
  value: T;
  label: React.ReactNode;
  key?: string | number;
};

// A reusable inset segmented control for a mutually-exclusive set of options.
// Values are compared with ===, so use it with primitive values (map an object
// state down to a primitive key before passing it in).
export default function Segmented<T>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className={styles.seg} role="group" aria-label={ariaLabel}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.key ?? i}
            type="button"
            aria-pressed={active}
            className={`${styles.opt} ${active ? styles.on : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
