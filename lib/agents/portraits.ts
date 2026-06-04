import portraits from "./portraits.json";

const BY_NAME = portraits as Record<string, string>;
const BY_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(BY_NAME).map(([k, v]) => [k.toLowerCase(), v]),
);

/** Full-portrait URL for an agent display name, or null if unknown/missing. */
export function agentPortrait(name: string | null | undefined): string | null {
  if (!name) return null;
  return BY_LOWER[name.toLowerCase()] ?? null;
}
