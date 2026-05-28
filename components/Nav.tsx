import Link from "next/link";
const tabs = [
  ["/home", "Home"],
  ["/track", "Track"],
  ["/improve", "Improve"],
  ["/showcase", "Showcase"],
] as const;
export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
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
    </nav>
  );
}
