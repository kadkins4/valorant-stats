import styles from "./home.module.css";

export default function GunCard({
  weapon,
  dist,
}: {
  weapon: string | null;
  dist: { head: number; body: number; leg: number };
}) {
  const rows: [string, number, string][] = [
    ["Head", dist.head, "#ff4655"],
    ["Body", dist.body, "#ff7a86"],
    ["Legs", dist.leg, "#8b93a7"],
  ];
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Most-used Gun</h3>
      <div className={styles.gunName}>{weapon ?? "—"}</div>
      <div className={styles.gunCaption}>hit location · all guns</div>
      <div className={styles.gunBody}>
        <svg
          className={styles.silo}
          width="46"
          height="92"
          viewBox="0 0 46 92"
          aria-hidden="true"
        >
          <circle cx="23" cy="12" r="9" fill="#ff4655" opacity="0.95" />
          <rect
            x="11"
            y="24"
            width="24"
            height="34"
            rx="7"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="3"
            y="26"
            width="7"
            height="26"
            rx="3.5"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="36"
            y="26"
            width="7"
            height="26"
            rx="3.5"
            fill="#ff7a86"
            opacity="0.7"
          />
          <rect
            x="13"
            y="60"
            width="8"
            height="30"
            rx="4"
            fill="#8b93a7"
            opacity="0.55"
          />
          <rect
            x="25"
            y="60"
            width="8"
            height="30"
            rx="4"
            fill="#8b93a7"
            opacity="0.55"
          />
        </svg>
        <div className={styles.hits}>
          {rows.map(([label, pct, color]) => (
            <div className={styles.hit} key={label}>
              <div className={styles.hitTop}>
                <span>{label}</span>
                <b>{Math.round(pct)}%</b>
              </div>
              <div className={styles.bar}>
                <i
                  className={styles.barFill}
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
