import { describe, it, expect } from "vitest";
import {
  midpoints,
  moveVertex,
  insertVertex,
  deleteVertex,
  type Pt,
} from "@/lib/maps/region-edit";

const square: Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

describe("midpoints", () => {
  it("returns one midpoint per edge, including the closing edge", () => {
    expect(midpoints(square)).toEqual([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]);
  });
});

describe("moveVertex", () => {
  it("replaces the vertex at index i", () => {
    expect(moveVertex(square, 1, [2, 2])).toEqual([
      [0, 0],
      [2, 2],
      [1, 1],
      [0, 1],
    ]);
  });
  it("returns the input unchanged for an out-of-range index", () => {
    expect(moveVertex(square, 9, [2, 2])).toBe(square);
  });
  it("does not mutate the input", () => {
    moveVertex(square, 0, [9, 9]);
    expect(square[0]).toEqual([0, 0]);
  });
});

describe("insertVertex", () => {
  it("splices the new point at edgeIndex + 1", () => {
    expect(insertVertex(square, 0, [0.5, 0])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  });
  it("appends when splitting the closing edge", () => {
    expect(insertVertex(square, 3, [0, 0.5])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0.5],
    ]);
  });
  it("returns the input unchanged for an out-of-range edgeIndex", () => {
    expect(insertVertex(square, 9, [0.5, 0.5])).toBe(square);
  });
});

describe("deleteVertex", () => {
  it("removes the vertex and heals for n > 3", () => {
    expect(deleteVertex(square, 1)).toEqual([
      [0, 0],
      [1, 1],
      [0, 1],
    ]);
  });
  it("returns null when the result would drop below 3 vertices", () => {
    const triangle: Pt[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    expect(deleteVertex(triangle, 0)).toBeNull();
  });
});
