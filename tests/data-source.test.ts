import { describe, it, expect } from "vitest";
import { withFallback } from "@/lib/db/data-source";

describe("withFallback", () => {
  it("returns the DB result when the loader succeeds", async () => {
    const out = await withFallback({
      fromDb: async () => "db",
      fromSnapshot: () => "snap",
    });
    expect(out).toBe("db");
  });

  it("falls back to the snapshot when the DB loader throws", async () => {
    const out = await withFallback({
      fromDb: async () => {
        throw new Error("DB down");
      },
      fromSnapshot: () => "snap",
    });
    expect(out).toBe("snap");
  });
});
