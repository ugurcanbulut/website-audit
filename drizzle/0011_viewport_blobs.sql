-- Sprint 5.2: move heavy blobs out of viewport_results into a sibling table.
-- Hot queries (scan list, dashboard, overview render) do not need these
-- columns and used to pull 10+ MB rows for no reason.

CREATE TABLE IF NOT EXISTS "viewport_result_blobs" (
  "viewport_result_id" uuid PRIMARY KEY
    REFERENCES "viewport_results"("id") ON DELETE CASCADE,
  "dom_snapshot" jsonb,
  "axe_results" jsonb,
  "page_html" text,
  "page_css" text,
  "lighthouse_json" jsonb
);
--> statement-breakpoint

-- Move existing data. NULLIF so we do not stamp rows that have no blob.
INSERT INTO "viewport_result_blobs" (
  "viewport_result_id",
  "dom_snapshot",
  "axe_results",
  "page_html",
  "page_css",
  "lighthouse_json"
)
SELECT
  "id",
  "dom_snapshot",
  "axe_results",
  "page_html",
  "page_css",
  "lighthouse_json"
FROM "viewport_results"
WHERE
  "dom_snapshot" IS NOT NULL
  OR "axe_results" IS NOT NULL
  OR "page_html" IS NOT NULL
  OR "page_css" IS NOT NULL
  OR "lighthouse_json" IS NOT NULL
ON CONFLICT ("viewport_result_id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "viewport_results"
  DROP COLUMN IF EXISTS "dom_snapshot",
  DROP COLUMN IF EXISTS "axe_results",
  DROP COLUMN IF EXISTS "page_html",
  DROP COLUMN IF EXISTS "page_css",
  DROP COLUMN IF EXISTS "lighthouse_json";
