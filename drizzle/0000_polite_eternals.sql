CREATE TABLE "audit_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"viewport_result_id" uuid,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"rule_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"element_selector" text,
	"element_html" text,
	"recommendation" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "category_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"category" text NOT NULL,
	"score" integer NOT NULL,
	"issue_count" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_provider" text,
	"viewports" jsonb NOT NULL,
	"overall_score" integer,
	"overall_grade" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "viewport_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"viewport_name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"screenshot_path" text NOT NULL,
	"dom_snapshot" jsonb,
	"performance_metrics" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_issues" ADD CONSTRAINT "audit_issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_issues" ADD CONSTRAINT "audit_issues_viewport_result_id_viewport_results_id_fk" FOREIGN KEY ("viewport_result_id") REFERENCES "public"."viewport_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD CONSTRAINT "viewport_results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;