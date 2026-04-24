-- Sprint 5.1: multi-tenancy foundation. All existing rows keep workspace_id = NULL
-- (single-tenant legacy mode); new rows created by authenticated users carry it.

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "retention_days" integer NOT NULL DEFAULT 90,
  "ai_monthly_budget_usd" numeric(10, 2),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_uniq" ON "workspaces" ("slug");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "password_hash" text,
  "email_verified_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uniq" ON "users" (lower("email"));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'viewer',
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_user_uniq"
  ON "workspace_members" ("workspace_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_user_id_idx"
  ON "workspace_members" ("user_id");
--> statement-breakpoint

-- Domain tables: add workspace_id + created_by_user_id (nullable to preserve
-- historical rows). Workspace deletion cascades; user deletion sets null so
-- the audit history survives.
ALTER TABLE "scans"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_workspace_id_idx" ON "scans" ("workspace_id");
--> statement-breakpoint

ALTER TABLE "scan_batches"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_batches_workspace_id_idx"
  ON "scan_batches" ("workspace_id");
--> statement-breakpoint

ALTER TABLE "crawls"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crawls_workspace_id_idx" ON "crawls" ("workspace_id");
--> statement-breakpoint

ALTER TABLE "ai_usage"
  ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_workspace_id_idx" ON "ai_usage" ("workspace_id");
