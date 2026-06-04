"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type CycleAgent = {
  name: string;
  winRate: number;
  games: number;
  portrait: string | null;
};

type CycleState = { agents: CycleAgent[]; index: number };

const CycleCtx = createContext<CycleState>({ agents: [], index: 0 });

export function useAgentCycle(): CycleState {
  return useContext(CycleCtx);
}

export default function AgentCycleProvider({
  agents,
  intervalMs = 5000,
  children,
}: {
  agents: CycleAgent[];
  intervalMs?: number;
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (agents.length <= 1) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let id: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (id) clearInterval(id);
      id = undefined;
    };
    const start = () => {
      if (mql.matches) return;
      id = setInterval(
        () => setIndex((i) => (i + 1) % agents.length),
        intervalMs,
      );
    };
    // Re-evaluate if the user toggles reduced-motion during the session.
    const onChange = () => {
      stop();
      setIndex(0);
      start();
    };
    start();
    mql.addEventListener("change", onChange);
    return () => {
      stop();
      mql.removeEventListener("change", onChange);
    };
  }, [agents.length, intervalMs]);
  return (
    <CycleCtx.Provider value={{ agents, index }}>{children}</CycleCtx.Provider>
  );
}
