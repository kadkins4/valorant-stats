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
    if (agents.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % agents.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [agents.length, intervalMs]);
  return (
    <CycleCtx.Provider value={{ agents, index }}>{children}</CycleCtx.Provider>
  );
}
