ALTER TABLE "crawl_pages" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD COLUMN "redirect_chain" jsonb;