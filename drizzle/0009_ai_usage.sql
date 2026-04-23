-- Pack C: per-call AI cost tracking. Not FK'd to scans so we don't cascade
-- the usage history when scans are deleted; kept as an audit log.

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scan_id" uuid,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "operation" text NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "image_tokens" integer,
  "cost_usd" numeric(10, 6),
  "duration_ms" integer,
  "errored" boolean NOT NULL DEFAULT false,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_scan_id_idx" ON "ai_usage" ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_created_at_idx" ON "ai_usage" ("created_at" DESC);
