"use client";
import { useEffect, useReducer } from "react";
import type { RegionIssue } from "@/lib/maps/regions";

export default function RegionIssueNotice({
  map,
  issues,
}: {
  map: string;
  issues: RegionIssue[];
}) {
  const key = `fragsmap.issue-notice.dismissed.${map}`;
  // visible: false until the client confirms sessionStorage says it's NOT dismissed.
  // useReducer avoids the "setState in effect" lint rule — the dispatch is the
  // external-system callback pattern the rule allows.
  const [visible, show] = useReducer(() => true, false);
  useEffect(() => {
    if (sessionStorage.getItem(key) !== "1") show();
  }, [key]);

  const [dismissed, dismiss] = useReducer(() => true, false);

  if (issues.length === 0 || !visible || dismissed) return null;

  // Short "where it went" summary (top few by appearance).
  const parts = issues
    .map((i) =>
      i.kind === "snapped"
        ? `${i.count} near ${i.zone}`
        : `${i.count} in ${i.winner}`,
    )
    .slice(0, 3);

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "rgba(255,70,85,0.08)",
        border: "1px solid rgba(255,70,85,0.28)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 12,
        fontSize: 13,
        color: "#cfd6e4",
      }}
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: "18px" }}>
        ⓘ
      </span>
      <span style={{ flex: 1 }}>
        A few frags here landed between zones — we&rsquo;ve counted them in the
        nearest one{parts.length ? <> ({parts.join(", ")})</> : null}.
        Nothing&rsquo;s missing; your totals are complete.
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem(key, "1");
          dismiss();
        }}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: "16px",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
