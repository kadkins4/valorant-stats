// Pure helpers for the home count-up animation (framework-free so they're unit-testable).
export function easeOutCubic(p: number): number {
  const c = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - c, 3);
}

export function countUpValue(
  target: number,
  progress: number,
  decimals = 0,
): string {
  return (target * easeOutCubic(progress)).toFixed(decimals);
}
