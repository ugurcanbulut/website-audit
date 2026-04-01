CREATE TABLE "scan_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"urls" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_scans" integer DEFAULT 0 NOT NULL,
	"completed_scans" integer DEFAULT 0 NOT NULL,
	"overall_score" integer,
	"overall_grade" text,
	"browser_engine" text DEFAULT 'chromium',
	"viewports" jsonb,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_provider" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_batch_id_scan_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."scan_batches"("id") ON DELETE cascade ON UPDATE no action;