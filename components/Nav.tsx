import Link from "next/link";
import RefreshBadge from "@/components/RefreshBadge";
import { lastUpdated } from "@/lib/db/queries";

const tabs = [
  { href: "/home", label: "Home", soon: false },
  { href: "/fragsmap", label: "FragsMap", soon: false },
  { href: "/track", label: "Track", soon: true },
  { href: "/improve", label: "Improve", soon: true },
] as const;

export default async function Nav() {
  const updatedAt = await lastUpdated();
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "14px 20px",
        borderBottom: "2px solid var(--accent)",
      }}
    >
      {tabs.map((t) =>
        t.soon ? (
          <span
            key={t.href}
            style={{
              padding: "4px 14px",
              borderRadius: 6,
              color: "var(--muted)",
              opacity: 0.55,
              cursor: "default",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--accent)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              Soon
            </span>
          </span>
        ) : (
          <Link
            key={t.href}
            href={t.href}
            style={{ padding: "4px 14px", borderRadius: 6 }}
          >
            {t.label}
          </Link>
        ),
      )}
      <RefreshBadge updatedAt={updatedAt} />
    </nav>
  );
}
