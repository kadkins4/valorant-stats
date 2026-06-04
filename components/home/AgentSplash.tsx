"use client";
import styles from "./home.module.css";
import { useAgentCycle } from "./AgentCycleProvider";

// Decorative only — hidden from assistive tech. Reads the shared agent cycle so
// it stays in sync with the Top-3 card; re-keying the <img> replays the fade.
export default function AgentSplash() {
  const { agents, index } = useAgentCycle();
  const src = agents[index]?.portrait ?? null;
  return (
    <div className={styles.splash} aria-hidden="true">
      <span className={styles.splashGlow} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          className={`${styles.splashImg} ${styles.splashFadeImg}`}
          src={src}
          alt=""
        />
      )}
    </div>
  );
}
