"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Splash({
  name,
  tag,
  level,
  region,
}: {
  name: string;
  tag: string;
  level: number;
  region: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/home"), 1500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800 }}>
        {name} <span style={{ color: "var(--muted)" }}>#{tag}</span>
      </div>
      <div style={{ color: "var(--muted)", marginTop: 6 }}>
        Level {level} · {region.toUpperCase()}
      </div>
      <div style={{ color: "var(--muted)", marginTop: 24, fontSize: 13 }}>
        loading your competitive data…
      </div>
    </div>
  );
}
