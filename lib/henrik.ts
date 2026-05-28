// lib/henrik.ts — server-only
import "dotenv/config";

const BASE = "https://api.henrikdev.xyz/valorant";
const KEY = () => process.env.VAL_API_KEY!;

// Basic tier = 30 req/min. Throttle ~2.2s between calls to stay safe.
let last = 0;
async function throttle() {
  const wait = 2200 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

async function get<T>(path: string): Promise<T> {
  await throttle();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: KEY() },
  });
  if (!res.ok) throw new Error(`HenrikDev ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const henrik = {
  account: (name: string, tag: string) =>
    get<any>(`/v2/account/${name}/${tag}`),
  mmr: (r: string, p: string, name: string, tag: string) =>
    get<any>(`/v3/mmr/${r}/${p}/${name}/${tag}`),
  mmrHistory: (r: string, p: string, name: string, tag: string) =>
    get<any>(`/v2/mmr-history/${r}/${p}/${name}/${tag}`),
  storedCompetitive: (r: string, name: string, tag: string, size = 200) =>
    get<any>(
      `/v1/stored-matches/${r}/${name}/${tag}?mode=competitive&size=${size}`,
    ),
  matchById: (r: string, id: string) => get<any>(`/v4/match/${r}/${id}`),
};
