CREATE TABLE "crawl_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"redirect_url" text,
	"content_type" text,
	"response_time_ms" integer,
	"content_size" integer,
	"title" text,
	"meta_description" text,
	"meta_robots" text,
	"canonical_url" text,
	"h1" jsonb,
	"h2" jsonb,
	"word_count" integer,
	"internal_links" jsonb,
	"external_links" jsonb,
	"images" jsonb,
	"structured_data" jsonb,
	"og_tags" jsonb,
	"hreflang" jsonb,
	"security_headers" jsonb,
	"errors" jsonb,
	"crawled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crawls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seed_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb NOT NULL,
	"total_pages" integer DEFAULT 0,
	"pages_crawled" integer DEFAULT 0,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_crawl_id_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."crawls"("id") ON DELETE cascade ON UPDATE no action;