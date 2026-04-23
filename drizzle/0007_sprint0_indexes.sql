-- Sprint 0: FK indexes, created_at sort indexes, idempotency constraint.
-- All CREATE INDEX use IF NOT EXISTS so the migration is safe to re-run.

CREATE INDEX IF NOT EXISTS "scans_batch_id_idx" ON "scans" ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_created_at_idx" ON "scans" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_status_idx" ON "scans" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "viewport_results_scan_id_idx" ON "viewport_results" ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_issues_scan_id_idx" ON "audit_issues" ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_issues_viewport_result_id_idx" ON "audit_issues" ("viewport_result_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_issues_severity_idx" ON "audit_issues" ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_scores_scan_id_idx" ON "category_scores" ("scan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crawl_pages_crawl_id_idx" ON "crawl_pages" ("crawl_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crawls_created_at_idx" ON "crawls" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_batches_created_at_idx" ON "scan_batches" ("created_at" DESC);
--> statement-breakpoint
-- Protect against retry duplication: a given scan cannot have two rows for
-- the same viewport name. Combined with BullMQ retries, the worker should
-- clean up prior rows on restart.
CREATE UNIQUE INDEX IF NOT EXISTS "viewport_results_scan_id_viewport_name_uniq" ON "viewport_results" ("scan_id", "viewport_name");
