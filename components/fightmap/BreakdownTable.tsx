"use client";
import type { CSSProperties } from "react";
import type { RegionRow, DuelRow } from "@/lib/fightmap/breakdown";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
  fontSize: 13,
};
const captionStyle: CSSProperties = {
  textAlign: "left",
  color: "var(--muted)",
  fontSize: 12,
  marginBottom: 6,
};
const th: CSSProperties = {
  textAlign: "left",
  color: "var(--muted)",
  fontWeight: 600,
  padding: "4px 8px",
  borderBottom: "1px solid #222a38",
};
const td: CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid #161b26",
};
const cellButton: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ece8e1",
  font: "inherit",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};
const rowActive: CSSProperties = { background: "#1b2230" };
const disclosure: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ffd166",
  font: "inherit",
  fontSize: 13,
  cursor: "pointer",
  padding: "4px 0",
};

export default function BreakdownTable({
  expanded,
  onToggle,
  regionRows,
  duelRows,
  regionName,
  focusedDuel,
  onSelectRegion,
  onSelectDuel,
}: {
  expanded: boolean;
  onToggle: () => void;
  regionRows?: RegionRow[];
  duelRows?: DuelRow[];
  regionName?: string;
  focusedDuel?: number | null;
  onSelectRegion?: (index: number) => void;
  onSelectDuel?: (index: number) => void;
}) {
  const zoomed = duelRows != null;
  const caption = zoomed
    ? `${regionName ?? "Region"} duels`
    : "Region breakdown";

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        style={disclosure}
      >
        {expanded ? "Hide breakdown" : "Show breakdown"}
      </button>
      {expanded && (
        <table style={tableStyle}>
          <caption style={captionStyle}>{caption}</caption>
          {zoomed ? (
            <>
              <thead>
                <tr>
                  <th scope="col" style={th}>
                    Outcome
                  </th>
                  <th scope="col" style={th}>
                    Weapon
                  </th>
                  <th scope="col" style={th}>
                    Round
                  </th>
                  <th scope="col" style={th}>
                    Enemy
                  </th>
                </tr>
              </thead>
              <tbody>
                {duelRows!.map((row) => (
                  <tr
                    key={row.index}
                    aria-current={
                      row.index === focusedDuel ? "true" : undefined
                    }
                    style={row.index === focusedDuel ? rowActive : undefined}
                  >
                    <td style={td}>
                      <button
                        type="button"
                        aria-label={row.label}
                        onClick={() => onSelectDuel?.(row.index)}
                        style={cellButton}
                      >
                        {row.won ? "Kill" : "Death"}
                        {row.opener && (
                          <span style={{ color: "#ffd166" }} aria-hidden="true">
                            {" "}
                            ⚡
                          </span>
                        )}
                      </button>
                    </td>
                    <td style={td}>{row.weapon ?? "—"}</td>
                    <td style={td}>{row.round ?? "—"}</td>
                    <td style={td}>{row.enemyAgent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th scope="col" style={th}>
                    Region
                  </th>
                  <th scope="col" style={th}>
                    Duels
                  </th>
                  <th scope="col" style={th}>
                    Win %
                  </th>
                  <th scope="col" style={th}>
                    Result
                  </th>
                  <th scope="col" style={th}>
                    Opener %
                  </th>
                </tr>
              </thead>
              <tbody>
                {(regionRows ?? []).map((row) => (
                  <tr key={row.index}>
                    <td style={td}>
                      <button
                        type="button"
                        aria-label={row.label}
                        onClick={() => onSelectRegion?.(row.index)}
                        style={cellButton}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td style={td}>{row.duels}</td>
                    <td style={td}>{Math.round(row.winRate * 100)}%</td>
                    <td
                      style={{
                        ...td,
                        color: row.muted ? "#8b93a3" : undefined,
                      }}
                    >
                      {row.result}
                    </td>
                    <td style={td}>
                      {row.openerTotal
                        ? `${row.openerWon}/${row.openerTotal} · ${Math.round(
                            (row.openerWon / row.openerTotal) * 100,
                          )}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      )}
    </div>
  );
}
