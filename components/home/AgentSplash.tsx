import styles from "./home.module.css";

// Decorative only — hidden from assistive tech.
export default function AgentSplash({ src }: { src: string }) {
  return (
    <div className={styles.splash} aria-hidden="true">
      <span className={styles.splashGlow} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.splashImg} src={src} alt="" />
    </div>
  );
}
