import { describe, it, expect } from "vitest";
import { clusterDuels, fanPositions, CLUSTER_RADIUS } from "@/lib/cluster";

// Points carry normalized nx,ny in 0..1; clustering happens in viewBox units (×100).
const P = (nx: number, ny: number) => ({ nx, ny });

describe("clusterDuels", () => {
  it("returns one singleton cluster per isolated dot", () => {
    const cs = clusterDuels([P(0.1, 0.1), P(0.8, 0.8)]);
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.members.length === 1)).toBe(true);
  });

  it("groups two dots within CLUSTER_RADIUS into one cluster with the centroid", () => {
    // (50,50) and (51,50) in viewBox units → distance 1 < CLUSTER_RADIUS
    const cs = clusterDuels([P(0.5, 0.5), P(0.51, 0.5)]);
    expect(cs).toHaveLength(1);
    expect(cs[0].members).toEqual([0, 1]);
    expect(cs[0].cx).toBeCloseTo(50.5, 5);
    expect(cs[0].cy).toBeCloseTo(50, 5);
  });

  it("keeps dots beyond the radius separate", () => {
    // (50,50) and (60,50) → distance 10 > CLUSTER_RADIUS
    const cs = clusterDuels([P(0.5, 0.5), P(0.6, 0.5)]);
    expect(cs).toHaveLength(2);
  });

  it("single-links a chain A-B-C into one cluster of 3", () => {
    // each adjacent pair within radius (2 units apart), ends 4 apart
    const cs = clusterDuels([P(0.5, 0.5), P(0.52, 0.5), P(0.54, 0.5)]);
    expect(cs).toHaveLength(1);
    expect(cs[0].members).toEqual([0, 1, 2]);
  });

  it("separates a far singleton from a near pair", () => {
    const cs = clusterDuels([P(0.5, 0.5), P(0.51, 0.5), P(0.9, 0.9)]);
    const sizes = cs.map((c) => c.members.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it("handles empty input", () => {
    expect(clusterDuels([])).toEqual([]);
  });

  it("is deterministic: clusters sorted by first member index, members ascending", () => {
    const cs = clusterDuels([P(0.9, 0.9), P(0.1, 0.1), P(0.11, 0.1)]);
    // member 0 is the lone far dot; members 1,2 are the near pair
    expect(cs[0].members).toEqual([0]);
    expect(cs[1].members).toEqual([1, 2]);
  });
});

describe("fanPositions", () => {
  it("returns n points equidistant (FAN_RADIUS) from the center", () => {
    const pts = fanPositions(50, 50, 4);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      const d = Math.hypot(p.x - 50, p.y - 50);
      expect(d).toBeCloseTo(6, 5); // default FAN_RADIUS
    }
  });

  it("starts at the top and goes clockwise", () => {
    const [first, second] = fanPositions(50, 50, 2);
    expect(first.x).toBeCloseTo(50, 5);
    expect(first.y).toBeCloseTo(44, 5); // top = cy - FAN_RADIUS
    expect(second.x).toBeCloseTo(50, 5);
    expect(second.y).toBeCloseTo(56, 5); // opposite point = cy + FAN_RADIUS
  });

  it("collapses to the center for n===1 and is empty for n===0", () => {
    expect(fanPositions(10, 20, 1)).toEqual([{ x: 10, y: 20 }]);
    expect(fanPositions(10, 20, 0)).toEqual([]);
  });

  it("respects an explicit fanRadius", () => {
    const [p] = fanPositions(0, 0, 2, 10);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5);
  });
});

it("CLUSTER_RADIUS is a fixed visual constant (~2× dot radius)", () => {
  expect(CLUSTER_RADIUS).toBeCloseTo(3.2, 5);
});
