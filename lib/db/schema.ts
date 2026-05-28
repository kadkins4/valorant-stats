import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

export const matches = pgTable("matches", {
  matchId: text("match_id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  season: text("season").notNull(),
  map: text("map").notNull(),
  agent: text("agent").notNull(),
  tier: integer("tier").notNull(),
  kills: integer("kills").notNull(),
  deaths: integer("deaths").notNull(),
  assists: integer("assists").notNull(),
  score: integer("score").notNull(),
  shotsHead: integer("shots_head").notNull(),
  shotsBody: integer("shots_body").notNull(),
  shotsLeg: integer("shots_leg").notNull(),
  damageMade: integer("damage_made").notNull(),
  damageReceived: integer("damage_received").notNull(),
  roundsWon: integer("rounds_won").notNull(),
  roundsLost: integer("rounds_lost").notNull(),
  won: boolean("won").notNull(),
  detail: jsonb("detail"),
  hasDetail: boolean("has_detail").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rankHistory = pgTable("rank_history", {
  matchId: text("match_id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  tier: integer("tier").notNull(),
  tierName: text("tier_name").notNull(),
  rr: integer("rr").notNull(),
  lastChange: integer("last_change").notNull(),
  elo: integer("elo").notNull(),
  map: text("map").notNull(),
});

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  matchesAdded: integer("matches_added").notNull().default(0),
  ranksAdded: integer("ranks_added").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  note: text("note"),
});

export type MatchRow = typeof matches.$inferInsert;
export type RankRow = typeof rankHistory.$inferInsert;
