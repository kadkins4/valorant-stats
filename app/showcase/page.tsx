import Nav from "@/components/Nav";
import FightMap from "@/components/fightmap/FightMap";
import { getFightData } from "@/lib/db/queries";

export default async function Showcase() {
  const matches = await getFightData();
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ marginBottom: 4 }}>Fight Map</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Where I win and lose my duels. Green zones = I win fights there; red =
          I lose them.
        </p>
        <FightMap matches={matches} />
      </main>
    </>
  );
}
