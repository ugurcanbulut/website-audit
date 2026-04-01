ALTER TABLE "category_scores" ADD COLUMN "lighthouse_score" integer;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "browser_engine" text DEFAULT 'chromium';--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "device_name" text;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "axe_results" jsonb;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "response_headers" jsonb;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "page_html" text;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "page_css" text;--> statement-breakpoint
ALTER TABLE "viewport_results" ADD COLUMN "lighthouse_json" jsonb;