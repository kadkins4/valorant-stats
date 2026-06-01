import Link from "next/link";
import RefreshBadge from "@/components/RefreshBadge";
import { lastUpdated } from "@/lib/db/queries";
const tabs = [
  ["/home", "Home"],
  ["/track", "Track"],
  ["/improve", "Improve"],
  ["/fragsmap", "FragsMap"],
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
      {tabs.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          style={{ padding: "4px 14px", borderRadius: 6 }}
        >
          {label}
        </Link>
      ))}
      <RefreshBadge updatedAt={updatedAt} />
    </nav>
  );
}
