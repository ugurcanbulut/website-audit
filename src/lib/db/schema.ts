import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ── Scan Batches ─────────────────────────────────────────────────────────────

export const scanBatches = pgTable('scan_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  urls: jsonb('urls').notNull(), // string[]
  status: text('status').notNull().default('pending'),
  totalScans: integer('total_scans').notNull().default(0),
  completedScans: integer('completed_scans').notNull().default(0),
  overallScore: integer('overall_score'),
  overallGrade: text('overall_grade'),
  browserEngine: text('browser_engine').default('chromium'),
  viewports: jsonb('viewports'), // shared viewport config for all scans
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiProvider: text('ai_provider'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  createdAtIdx: index('scan_batches_created_at_idx').on(sql`${t.createdAt} DESC`),
}));

export const scanBatchesRelations = relations(scanBatches, ({ many }) => ({
  scans: many(scans),
}));

// ── Scans ────────────────────────────────────────────────────────────────────

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  batchId: uuid('batch_id').references(() => scanBatches.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiProvider: text('ai_provider'),
  browserEngine: text('browser_engine').default('chromium'),
  viewports: jsonb('viewports').notNull(),
  overallScore: integer('overall_score'),
  overallGrade: text('overall_grade'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  batchIdIdx: index('scans_batch_id_idx').on(t.batchId),
  createdAtIdx: index('scans_created_at_idx').on(sql`${t.createdAt} DESC`),
  statusIdx: index('scans_status_idx').on(t.status),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  batch: one(scanBatches, {
    fields: [scans.batchId],
    references: [scanBatches.id],
  }),
  viewportResults: many(viewportResults),
  auditIssues: many(auditIssues),
  categoryScores: many(categoryScores),
}));

// ── Viewport Results ─────────────────────────────────────────────────────────

export const viewportResults = pgTable('viewport_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id')
    .notNull()
    .references(() => scans.id, { onDelete: 'cascade' }),
  viewportName: text('viewport_name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  screenshotPath: text('screenshot_path').notNull(),
  domSnapshot: jsonb('dom_snapshot'),
  performanceMetrics: jsonb('performance_metrics'),
  deviceName: text('device_name'),
  axeResults: jsonb('axe_results'),
  responseHeaders: jsonb('response_headers'),
  pageHtml: text('page_html'),
  pageCss: text('page_css'),
  lighthouseJson: jsonb('lighthouse_json'),
  screenshotWidth: integer('screenshot_width'),
  screenshotHeight: integer('screenshot_height'),
  viewportScreenshotPath: text('viewport_screenshot_path'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  scanIdIdx: index('viewport_results_scan_id_idx').on(t.scanId),
  // Protects against BullMQ retry duplication of viewport rows for the same scan.
  scanIdViewportNameUniq: uniqueIndex('viewport_results_scan_id_viewport_name_uniq')
    .on(t.scanId, t.viewportName),
}));

export const viewportResultsRelations = relations(viewportResults, ({ one, many }) => ({
  scan: one(scans, {
    fields: [viewportResults.scanId],
    references: [scans.id],
  }),
  auditIssues: many(auditIssues),
}));

// ── Audit Issues ─────────────────────────────────────────────────────────────

export const auditIssues = pgTable('audit_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id')
    .notNull()
    .references(() => scans.id, { onDelete: 'cascade' }),
  viewportResultId: uuid('viewport_result_id').references(
    () => viewportResults.id,
    { onDelete: 'cascade' }
  ),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  ruleId: text('rule_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  elementSelector: text('element_selector'),
  elementHtml: text('element_html'),
  recommendation: text('recommendation'),
  details: jsonb('details'),
}, (t) => ({
  scanIdIdx: index('audit_issues_scan_id_idx').on(t.scanId),
  viewportResultIdIdx: index('audit_issues_viewport_result_id_idx').on(t.viewportResultId),
  severityIdx: index('audit_issues_severity_idx').on(t.severity),
}));

export const auditIssuesRelations = relations(auditIssues, ({ one }) => ({
  scan: one(scans, {
    fields: [auditIssues.scanId],
    references: [scans.id],
  }),
  viewportResult: one(viewportResults, {
    fields: [auditIssues.viewportResultId],
    references: [viewportResults.id],
  }),
}));

// ── Category Scores ──────────────────────────────────────────────────────────

export const categoryScores = pgTable('category_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  scanId: uuid('scan_id')
    .notNull()
    .references(() => scans.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  score: integer('score').notNull(),
  issueCount: jsonb('issue_count').notNull(),
  lighthouseScore: integer('lighthouse_score'),
}, (t) => ({
  scanIdIdx: index('category_scores_scan_id_idx').on(t.scanId),
}));

export const categoryScoresRelations = relations(categoryScores, ({ one }) => ({
  scan: one(scans, {
    fields: [categoryScores.scanId],
    references: [scans.id],
  }),
}));

// ── Crawls ───────────────────────────────────────────────────────────────
export const crawls = pgTable('crawls', {
  id: uuid('id').primaryKey().defaultRandom(),
  seedUrl: text('seed_url').notNull(),
  status: text('status').notNull().default('pending'),
  config: jsonb('config').notNull(), // CrawlConfig
  totalPages: integer('total_pages').default(0),
  pagesCrawled: integer('pages_crawled').default(0),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  createdAtIdx: index('crawls_created_at_idx').on(sql`${t.createdAt} DESC`),
}));

export const crawlsRelations = relations(crawls, ({ many }) => ({
  pages: many(crawlPages),
}));

export const crawlPages = pgTable('crawl_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  crawlId: uuid('crawl_id').notNull().references(() => crawls.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  statusCode: integer('status_code'),
  redirectUrl: text('redirect_url'),
  contentType: text('content_type'),
  responseTimeMs: integer('response_time_ms'),
  contentSize: integer('content_size'),
  title: text('title'),
  metaDescription: text('meta_description'),
  metaRobots: text('meta_robots'),
  canonicalUrl: text('canonical_url'),
  h1: jsonb('h1'), // string[]
  h2: jsonb('h2'), // string[]
  wordCount: integer('word_count'),
  internalLinks: jsonb('internal_links'), // {href, anchor, nofollow}[]
  externalLinks: jsonb('external_links'),
  images: jsonb('images'), // {src, alt, width?, height?}[]
  structuredData: jsonb('structured_data'),
  ogTags: jsonb('og_tags'),
  hreflang: jsonb('hreflang'),
  securityHeaders: jsonb('security_headers'),
  errors: jsonb('errors'), // string[]
  crawlDepth: integer('crawl_depth'),
  contentHash: text('content_hash'),         // simhash for duplicate detection
  redirectChain: jsonb('redirect_chain'),    // Array of {url, statusCode}
  inlinksCount: integer('inlinks_count'),
  crawledAt: timestamp('crawled_at').defaultNow(),
}, (t) => ({
  crawlIdIdx: index('crawl_pages_crawl_id_idx').on(t.crawlId),
}));

export const crawlPagesRelations = relations(crawlPages, ({ one }) => ({
  crawl: one(crawls, {
    fields: [crawlPages.crawlId],
    references: [crawls.id],
  }),
}));
