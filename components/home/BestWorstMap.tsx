import styles from "./home.module.css";

type Side = { map: string; winRate: number; image: string | null };

export default function BestWorstMap({
  best,
  worst,
}: {
  best: Side | null;
  worst: Side | null;
}) {
  const bg = (img: string | null, dark: string) =>
    img
      ? `linear-gradient(180deg, ${dark}, #0e1015ee), url('${img}')`
      : `linear-gradient(180deg, ${dark}, #0e1015ee)`;
  return (
    <div className={`${styles.card} ${styles.bwCard}`}>
      <h3 className={styles.bwTitle}>Best / Worst Map</h3>
      <div
        className={`${styles.bwHalf} ${styles.bwL}`}
        style={{ backgroundImage: bg(best?.image ?? null, "#0b3a24aa") }}
      >
        <div className={styles.bwInner}>
          <div className={styles.bwTag}>Best</div>
          <div className={styles.bwMap}>{best?.map ?? "—"}</div>
          <div className={styles.bwPctG}>{Math.round(best?.winRate ?? 0)}%</div>
        </div>
      </div>
      <div
        className={`${styles.bwHalf} ${styles.bwR}`}
        style={{ backgroundImage: bg(worst?.image ?? null, "#3a0b14aa") }}
      >
        <div className={styles.bwInner}>
          <div className={styles.bwTag}>Worst</div>
          <div className={styles.bwMap}>{worst?.map ?? "—"}</div>
          <div className={styles.bwPctR}>
            {Math.round(worst?.winRate ?? 0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
