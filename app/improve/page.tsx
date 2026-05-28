import Nav from "@/components/Nav";
export default function Improve() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 20px" }}>
        <h1>Improve</h1>
        <p style={{ color: "var(--muted)" }}>
          Coming soon — weak-map/agent signals, ban &amp; dodge suggestions,
          agent-pool gaps.
        </p>
      </main>
    </>
  );
}
