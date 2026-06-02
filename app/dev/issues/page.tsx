import Link from "next/link";
import { getFightData } from "@/lib/db/queries";
import { getCalibration } from "@/lib/maps/calibration";
import { collectDuels, placeDuels } from "@/lib/fightmap";
import { REGIONS } from "@/lib/maps/regions/index";
import { getRegions, issuesForMap, type RegionIssue } from "@/lib/maps/regions";
import IssuesList from "@/components/dev/IssuesList";

export default async function RegionIssuesPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
        <p style={{ color: "var(--muted)" }}>
          This authoring tool is only available in local dev.
        </p>
      </main>
    );
  }

  const matches = await getFightData();
  const issues: RegionIssue[] = [];
  for (const slug of Object.keys(REGIONS)) {
    const cal = getCalibration(slug);
    if (!cal) continue;
    const regions = getRegions(slug);
    if (!regions.length) continue;
    const points = placeDuels(
      collectDuels(matches, {
        map: cal.name,
        side: "both",
        time: { kind: "all" },
      }),
      cal,
    );
    issues.push(...issuesForMap(cal.name, points, regions));
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ marginBottom: 4 }}>Region issues</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
        Dev-only. Frags resolved by overlap, or snapped in from outside a zone —
        adjust polygons in the{" "}
        <Link href="/dev/regions" style={{ color: "var(--accent)" }}>
          region editor
        </Link>
        .
      </p>
      <IssuesList issues={issues} />
    </main>
  );
}
