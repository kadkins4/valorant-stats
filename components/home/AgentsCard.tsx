"use client";
import styles from "./home.module.css";
import { useAgentCycle } from "./AgentCycleProvider";

export default function AgentsCard() {
  const { agents, index } = useAgentCycle();
  const a = agents[index];
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Top 3 Agents</h3>
      {a?.portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`t${index}`}
          className={`${styles.agentThumb} ${styles.agentFade}`}
          src={a.portrait}
          alt=""
        />
      )}
      <div
        key={`n${index}`}
        className={`${styles.agentName} ${styles.agentFade}`}
      >
        {a?.name ?? "—"}
      </div>
      <div
        key={`w${index}`}
        className={`${styles.agentWr} ${styles.agentFade}`}
      >
        {Math.round(a?.winRate ?? 0)}%{" "}
        <span>win rate · {a?.games ?? 0} games</span>
      </div>
      <div className={styles.dots}>
        {agents.map((_, k) => (
          <i key={k} className={k === index ? styles.dotOn : undefined} />
        ))}
      </div>
    </div>
  );
}
