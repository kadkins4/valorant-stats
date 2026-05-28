CREATE TABLE "matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"season" text NOT NULL,
	"map" text NOT NULL,
	"agent" text NOT NULL,
	"tier" integer NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"score" integer NOT NULL,
	"shots_head" integer NOT NULL,
	"shots_body" integer NOT NULL,
	"shots_leg" integer NOT NULL,
	"damage_made" integer NOT NULL,
	"damage_received" integer NOT NULL,
	"rounds_won" integer NOT NULL,
	"rounds_lost" integer NOT NULL,
	"won" boolean NOT NULL,
	"detail" jsonb,
	"has_detail" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_history" (
	"match_id" text PRIMARY KEY NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"tier" integer NOT NULL,
	"tier_name" text NOT NULL,
	"rr" integer NOT NULL,
	"last_change" integer NOT NULL,
	"elo" integer NOT NULL,
	"map" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matches_added" integer DEFAULT 0 NOT NULL,
	"ranks_added" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"note" text
);
