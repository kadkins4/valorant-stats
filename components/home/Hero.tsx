import Link from "next/link";
import styles from "./home.module.css";
import CountUp from "./CountUp";
import type { HomeData } from "@/lib/home/types";

export default function Hero(d: HomeData) {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Spatial VALORANT analytics</p>
      <h1 className={styles.wordmark}>
        VAN<span>TAGE</span>
      </h1>
      <p className={styles.pitch}>
        Every kill and death from your ranked matches, plotted on the map — see
        exactly where you win, and where you don&apos;t.
      </p>
      <div className={styles.ridWrap}>
        <div className={styles.ridLabel}>Your stats · Riot ID coming soon</div>
        <div className={styles.rid}>
          <input
            className={styles.ridInput}
            placeholder="Coming soon"
            disabled
            aria-label="Riot ID (coming soon)"
          />
          <button className={styles.ridBtn} disabled>
            Track →
          </button>
        </div>
      </div>
      <Link className={styles.cta} href="/fragsmap">
        Explore FragsMap →
      </Link>
      <div className={styles.quickStats}>
        <div>
          <CountUp className={styles.quickNum} to={d.winPct} />
          <span className={styles.quickLabel}>Win %</span>
        </div>
        <div>
          <CountUp className={styles.quickNum} to={d.kd} decimals={2} />
          <span className={styles.quickLabel}>K/D</span>
        </div>
        <div>
          <CountUp className={styles.quickNum} to={d.matches} />
          <span className={styles.quickLabel}>Matches</span>
        </div>
      </div>
    </section>
  );
}
