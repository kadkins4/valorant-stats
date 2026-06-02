import { describe, it, expect } from "vitest";
import { revealResolveDelay, shouldReveal } from "@/lib/home/reveal";

describe("revealResolveDelay", () => {
  const base = { minMs: 1800, maxMs: 3500 };
  it("returns minMs when fonts+data are ready before the minimum", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: 200 }),
    ).toBe(1800);
  });
  it("waits for late data/fonts up to the cap", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: 2400 }),
    ).toBe(2400);
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 2900, fontsReadyAt: 200 }),
    ).toBe(2900);
  });
  it("never exceeds maxMs (fail-open when fonts hang)", () => {
    expect(
      revealResolveDelay({ ...base, dataReadyAt: 0, fontsReadyAt: Infinity }),
    ).toBe(3500);
  });
});

describe("shouldReveal", () => {
  it("plays only when not reduced-motion and not already revealed", () => {
    expect(shouldReveal({ reducedMotion: false, alreadyRevealed: false })).toBe(
      true,
    );
    expect(shouldReveal({ reducedMotion: true, alreadyRevealed: false })).toBe(
      false,
    );
    expect(shouldReveal({ reducedMotion: false, alreadyRevealed: true })).toBe(
      false,
    );
  });
});
