import RegionEditor from "@/components/dev/RegionEditor";

export default function RegionsDevPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
        <p style={{ color: "var(--muted)" }}>
          This authoring tool is only available in local dev.
        </p>
      </main>
    );
  }
  return <RegionEditor />;
}
