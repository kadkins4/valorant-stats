"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { chip } from "@/components/fightmap/MapPicker";
import {
  calibratedMaps,
  getCalibration,
  getCallouts,
} from "@/lib/maps/calibration";
import { getRegions, type RegionPoly } from "@/lib/maps/regions";

type Pt = [number, number];

const MAPS = calibratedMaps();
const DEFAULT_MAP = MAPS.includes("Ascent") ? "Ascent" : (MAPS[0] ?? "");

const btn = (
  variant: "primary" | "ghost" | "danger" = "ghost",
): React.CSSProperties => ({
  padding: "6px 13px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #2c3447",
  background:
    variant === "primary"
      ? "var(--accent)"
      : variant === "danger"
        ? "#3a1f26"
        : "#222a38",
  color: variant === "danger" ? "#ff8e9e" : "#e6e9f0",
  transition: "background 0.15s, opacity 0.15s",
});

export default function RegionEditor() {
  const [map, setMap] = useState(DEFAULT_MAP);
  const [regions, setRegions] = useState<RegionPoly[]>(() =>
    getRegions(DEFAULT_MAP).map((r) => ({
      name: r.name,
      points: [...r.points],
    })),
  );
  const [buffer, setBuffer] = useState<Pt[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const calibration = getCalibration(map);
  const callouts = useMemo(() => getCallouts(map), [map]);
  const calloutNames = useMemo(
    () => Array.from(new Set(callouts.map((c) => c.regionName))).sort(),
    [callouts],
  );

  // Switch maps: load existing saved regions and reset transient state.
  const selectMap = (m: string) => {
    if (m === map) return;
    setMap(m);
    setRegions(
      getRegions(m).map((r) => ({ name: r.name, points: [...r.points] })),
    );
    setBuffer([]);
    setSelected(null);
    setNaming(false);
    setNameInput("");
    setSaveStatus("");
  };

  // Focus the name input when the naming dialog opens.
  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  const undo = () => setBuffer((b) => b.slice(0, -1));
  const cancel = () => {
    setBuffer([]);
    setNaming(false);
    setNameInput("");
  };

  // Keyboard: Cmd/Ctrl+Z = undo vertex, Esc = cancel buffer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (tag !== "INPUT") undo();
      } else if (e.key === "Escape") {
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (naming) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    setBuffer((b) => [...b, [nx, ny]]);
  };

  const confirmName = () => {
    const name = nameInput.trim();
    if (!name || buffer.length < 3) return;
    setRegions((r) => [...r, { name, points: buffer }]);
    setBuffer([]);
    setNaming(false);
    setNameInput("");
  };

  const deleteRegion = (i: number) => {
    setRegions((r) => r.filter((_, idx) => idx !== i));
    setSelected((s) => (s === i ? null : s !== null && s > i ? s - 1 : s));
  };

  const seedCallouts = () => {
    setRegions((r) => {
      const existing = new Set(r.map((x) => x.name.toLowerCase()));
      const additions = calloutNames
        .filter((n) => !existing.has(n.toLowerCase()))
        .map((n) => ({ name: n, points: [] as Pt[] }));
      return [...r, ...additions];
    });
  };

  // Export: only regions with a real polygon (>=3 vertices).
  const exportRegions = useMemo(
    () => regions.filter((r) => r.points.length >= 3),
    [regions],
  );
  const exportJson = useMemo(
    () => JSON.stringify(exportRegions, null, 2),
    [exportRegions],
  );

  const copy = () => {
    navigator.clipboard?.writeText(exportJson);
  };
  const save = async () => {
    setSaving(true);
    setSaveStatus("Saving…");
    try {
      const res = await fetch("/api/dev/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map, regions: exportRegions }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSaveStatus(
        "Saved ✓ — switch to FragsMap to see it (may need a refresh)",
      );
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };
  const download = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${map.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const poly = (pts: Pt[]) =>
    pts.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ marginBottom: 4 }}>Region Editor</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
        Dev-only. Click the minimap to trace a polygon, name it, export per-map
        JSON.
      </p>
      <p style={{ marginTop: 8, fontSize: 13 }}>
        <Link href="/dev/issues" style={{ color: "var(--accent)" }}>
          View region issues →
        </Link>
      </p>

      {/* Map picker */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}
      >
        {MAPS.map((m) => (
          <button key={m} style={chip(m === map)} onClick={() => selectMap(m)}>
            {m}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Canvas + controls */}
        <div>
          <div style={{ position: "relative", maxWidth: 640 }}>
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              width="100%"
              onClick={handleCanvasClick}
              style={{
                display: "block",
                borderRadius: 10,
                border: "1px solid #222a38",
                aspectRatio: "1 / 1",
                cursor: naming ? "default" : "crosshair",
                background: "#0c0f16",
              }}
            >
              {calibration && (
                <image
                  href={calibration.image}
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  opacity="0.7"
                  preserveAspectRatio="xMidYMid slice"
                />
              )}

              {/* Completed regions */}
              {regions.map((r, i) =>
                r.points.length >= 3 ? (
                  <polygon
                    key={i}
                    points={poly(r.points)}
                    fill={
                      i === selected
                        ? "rgba(94,160,255,0.45)"
                        : "rgba(94,160,255,0.18)"
                    }
                    stroke={i === selected ? "#7db4ff" : "#3f6dad"}
                    strokeWidth={i === selected ? 0.6 : 0.35}
                    style={{ pointerEvents: "none" }}
                  />
                ) : null,
              )}

              {/* In-progress polygon */}
              {buffer.length > 0 && (
                <g style={{ pointerEvents: "none" }}>
                  {buffer.length >= 3 && (
                    <polygon
                      points={poly(buffer)}
                      fill="rgba(120,255,180,0.12)"
                      stroke="none"
                    />
                  )}
                  <polyline
                    points={poly(buffer)}
                    fill="none"
                    stroke="#5effa0"
                    strokeWidth="0.5"
                  />
                  {buffer.length >= 3 && (
                    <line
                      x1={buffer[buffer.length - 1][0] * 100}
                      y1={buffer[buffer.length - 1][1] * 100}
                      x2={buffer[0][0] * 100}
                      y2={buffer[0][1] * 100}
                      stroke="#5effa0"
                      strokeWidth="0.3"
                      strokeDasharray="1 1"
                      opacity="0.5"
                    />
                  )}
                  {buffer.map(([x, y], i) => (
                    <circle
                      key={i}
                      cx={x * 100}
                      cy={y * 100}
                      r="0.9"
                      fill={i === 0 ? "#fff" : "#5effa0"}
                      stroke="#11151d"
                      strokeWidth="0.2"
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>

          {/* Controls */}
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
          >
            <button
              style={{ ...btn(), opacity: buffer.length ? 1 : 0.5 }}
              disabled={!buffer.length}
              onClick={undo}
            >
              Undo vertex
            </button>
            <button
              style={{
                ...btn("primary"),
                opacity: buffer.length >= 3 ? 1 : 0.5,
              }}
              disabled={buffer.length < 3}
              onClick={() => setNaming(true)}
            >
              Finish region
            </button>
            <button
              style={{ ...btn(), opacity: buffer.length ? 1 : 0.5 }}
              disabled={!buffer.length}
              onClick={cancel}
            >
              Cancel
            </button>
            <button style={btn()} onClick={seedCallouts}>
              Seed callout names
            </button>
          </div>

          {naming && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                background: "#161b26",
                border: "1px solid #2c3447",
              }}
            >
              <input
                ref={nameRef}
                list="callout-names"
                value={nameInput}
                placeholder="Region name…"
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmName();
                }}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid #2c3447",
                  background: "#0c0f16",
                  color: "#e6e9f0",
                  fontSize: 14,
                }}
              />
              <datalist id="callout-names">
                {calloutNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button
                style={{
                  ...btn("primary"),
                  opacity: nameInput.trim() ? 1 : 0.5,
                }}
                disabled={!nameInput.trim()}
                onClick={confirmName}
              >
                Save
              </button>
              <button style={btn()} onClick={cancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Export */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <strong style={{ fontSize: 14 }}>
                Export ({exportRegions.length})
              </strong>
              <button
                style={{ ...btn("primary"), opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onClick={save}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button style={btn()} onClick={copy}>
                Copy
              </button>
              <button style={btn()} onClick={download}>
                Download {map.toLowerCase()}.json
              </button>
            </div>
            <textarea
              readOnly
              value={exportJson}
              style={{
                width: "100%",
                height: 220,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #2c3447",
                background: "#0c0f16",
                color: "#9fe6b8",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                resize: "vertical",
              }}
            />
            {saveStatus && (
              <p
                style={{
                  color: saveStatus.startsWith("Saved")
                    ? "#9fe6b8"
                    : "var(--muted)",
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                {saveStatus}
              </p>
            )}
          </div>
        </div>

        {/* Region list */}
        <div
          style={{
            border: "1px solid #222a38",
            borderRadius: 10,
            padding: 12,
            background: "#11151d",
          }}
        >
          <strong style={{ fontSize: 14 }}>Regions ({regions.length})</strong>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {regions.length === 0 && (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                No regions yet. Trace one on the map.
              </span>
            )}
            {regions.map((r, i) => {
              const empty = r.points.length < 3;
              return (
                <div
                  key={i}
                  onClick={() => setSelected(i === selected ? null : i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: i === selected ? "#1d2942" : "#181d28",
                    border:
                      i === selected
                        ? "1px solid #3f6dad"
                        : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: empty ? "#7c8499" : "#e6e9f0",
                    }}
                  >
                    {r.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {empty ? "empty" : `${r.points.length} pts`}
                  </span>
                  <button
                    style={{
                      ...btn("danger"),
                      padding: "2px 8px",
                      fontSize: 12,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRegion(i);
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
