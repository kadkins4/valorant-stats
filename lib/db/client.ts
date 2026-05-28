import "dotenv/config";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

// Connect to Neon when DATABASE_URL is set. When it is NOT set (local dev before
// the database is provisioned, or a misconfigured deploy), expose a stub whose
// every property access throws. Callers go through withFallback() in
// lib/db/data-source.ts, which catches the error and serves data/snapshot.json —
// so the app still renders with no database configured.
export const db: NeonHttpDatabase<typeof schema> = url
  ? drizzle(neon(url), { schema })
  : (new Proxy(
      {},
      {
        get(_target, prop) {
          // Allow benign inspection (await checks, string coercion) without
          // throwing; only real query access (db.select, db.insert, …) fails,
          // which withFallback() catches and turns into a snapshot read.
          if (typeof prop === "symbol" || prop === "then") return undefined;
          throw new Error(
            "DATABASE_URL is not set — falling back to snapshot.json",
          );
        },
      },
    ) as NeonHttpDatabase<typeof schema>);
