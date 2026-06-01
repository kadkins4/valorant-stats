import { NextResponse } from "next/server";
import type { RegionPoly } from "@/lib/maps/regions";
import { regenerateIndex, writeMapRegions } from "@/lib/maps/regions/_codegen";

// fs writes require the Node runtime, not edge.
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { map, regions } = (body ?? {}) as {
    map?: unknown;
    regions?: unknown;
  };

  if (typeof map !== "string" || map.trim() === "") {
    return NextResponse.json(
      { error: "map must be a non-empty string" },
      { status: 400 },
    );
  }
  if (/[\\/]/.test(map) || map.includes("..")) {
    return NextResponse.json({ error: "invalid map name" }, { status: 400 });
  }
  if (!Array.isArray(regions)) {
    return NextResponse.json(
      { error: "regions must be an array" },
      { status: 400 },
    );
  }

  await writeMapRegions(map, regions as RegionPoly[]);
  const mapsWired = await regenerateIndex();

  return NextResponse.json({ ok: true, mapsWired });
}
