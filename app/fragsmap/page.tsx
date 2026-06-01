import Nav from "@/components/Nav";
import FightMap from "@/components/fightmap/FightMap";
import { getFightData } from "@/lib/db/queries";

export default async function FragsMap() {
  const matches = await getFightData();
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ marginBottom: 4 }}>FragsMap</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Where my gunfights happen — green = I win duels there, red = I lose
          them.
        </p>
        <FightMap matches={matches} />
      </main>
    </>
  );
}
