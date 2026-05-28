import Nav from "@/components/Nav";
export default function Showcase() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px" }}>
        <h1>Showcase</h1>
        <p style={{ color: "var(--muted)" }}>
          Coming soon — kill/death heatmaps from match coordinates.
        </p>
      </main>
    </>
  );
}
