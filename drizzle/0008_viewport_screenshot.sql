-- Pack A: viewport-sized screenshot stored alongside the full-page image
-- for AI analysis at native model resolution (1920x1080 desktop, 412x823 mobile).

ALTER TABLE "viewport_results" ADD COLUMN IF NOT EXISTS "viewport_screenshot_path" text;
