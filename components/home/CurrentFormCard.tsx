import styles from "./home.module.css";
import Sparkline from "./Sparkline";

export default function CurrentFormCard({
  record,
  kd,
  hs,
  adr,
  series,
}: {
  record: string;
  kd: number;
  hs: number;
  adr: number;
  series: number[];
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Current Form</h3>
      <div className={styles.formRec}>{record}</div>
      <div className={styles.formSpark}>
        <Sparkline values={series} />
      </div>
      <div className={styles.formSub}>
        KD {kd.toFixed(2)} · HS {Math.round(hs)}% · ADR {Math.round(adr)}
      </div>
    </div>
  );
}
