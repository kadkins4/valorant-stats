import { describe, it, expect } from "vitest";
import { agentPortrait } from "@/lib/agents/portraits";

describe("agentPortrait", () => {
  it("resolves a known agent case-insensitively", () => {
    const a = agentPortrait("Jett");
    const b = agentPortrait("jett");
    expect(a).toMatch(
      /^https:\/\/media\.valorant-api\.com\/agents\/.+\/fullPortrait\.png$/i,
    );
    expect(b).toBe(a);
  });
  it("returns null for unknown agents", () => {
    expect(agentPortrait("NotAnAgent")).toBeNull();
  });
  it("returns null for missing input", () => {
    expect(agentPortrait(null)).toBeNull();
    expect(agentPortrait(undefined)).toBeNull();
  });
});
