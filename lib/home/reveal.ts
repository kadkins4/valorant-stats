export function revealResolveDelay(args: {
  minMs: number;
  maxMs: number;
  dataReadyAt: number; // ms from reveal start
  fontsReadyAt: number; // ms from reveal start (Infinity if unknown)
}): number {
  const gate = Math.max(args.minMs, args.dataReadyAt, args.fontsReadyAt);
  return Math.min(args.maxMs, gate);
}

export function shouldReveal(args: {
  reducedMotion: boolean;
  alreadyRevealed: boolean;
}): boolean {
  return !args.reducedMotion && !args.alreadyRevealed;
}

export const REVEAL_MIN_MS = 1800;
export const REVEAL_MAX_MS = 3500;
export const REVEAL_KEY = "vantage:revealed";
