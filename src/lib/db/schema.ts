import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ── Workspaces / Users / Members ─────────────────────────────────────────────
// Multi-tenancy foundation. All domain rows gain a nullable workspace_id;
// existing single-tenant data stays NULL and remains visible to any
// authenticated admin. Application queries add a workspace filter when the
// caller is identified.

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  retentionDays: integer('retention_days').notNull().default(90),
  aiMonthlyBudgetUsd: numeric('ai_monthly_budget_usd', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  slugUniq: uniqueIndex('workspaces_slug_uniq').on(t.slug),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name'),
  // passwordHash is bcrypt; optional because SSO (Sprint 7) bypasses it.
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  emailUniq: uniqueIndex('users_email_uniq').on(sql`lower(${t.email})`),
}));

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'), // admin | auditor | viewer
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  workspaceUserUniq: uniqueIndex('workspace_members_workspace_user_uniq')
    .on(t.workspaceId, t.userId),
  userIdIdx: index('workspace_members_user_id_idx').on(t.userId),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
}));
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
}));
export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  }),
);

// ── Scan Batches ─────────────────────────────────────────────────────────────

export const scanBatches = pgTable('scan_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  workspaceIdIdx: index('scan_batches_workspace_id_idx').on(t.workspaceId),
}));

export const scanBatchesRelations = relations(scanBatches, ({ many }) => ({
  scans: many(scans),
}));

// ── Scans ────────────────────────────────────────────────────────────────────

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  workspaceIdIdx: index('scans_workspace_id_idx').on(t.workspaceId),
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
  // Small, always-queried fields stay on the hot row. Heavy blobs moved
  // to viewport_result_blobs so list queries don't drag MBs per row.
  performanceMetrics: jsonb('performance_metrics'),
  deviceName: text('device_name'),
  responseHeaders: jsonb('response_headers'),
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

// Heavy artefacts kept in a separate table so the hot viewport_results row
// stays <1KB. The audit engine writes this during processing; the UI reads
// it only when the Lighthouse or By-Viewport tab opens.
export const viewportResultBlobs = pgTable('viewport_result_blobs', {
  viewportResultId: uuid('viewport_result_id')
    .primaryKey()
    .references(() => viewportResults.id, { onDelete: 'cascade' }),
  domSnapshot: jsonb('dom_snapshot'),
  axeResults: jsonb('axe_results'),
  pageHtml: text('page_html'),
  pageCss: text('page_css'),
  lighthouseJson: jsonb('lighthouse_json'),
});

export const viewportResultsRelations = relations(viewportResults, ({ one, many }) => ({
  scan: one(scans, {
    fields: [viewportResults.scanId],
    references: [scans.id],
  }),
  auditIssues: many(auditIssues),
  blobs: one(viewportResultBlobs, {
    fields: [viewportResults.id],
    references: [viewportResultBlobs.viewportResultId],
  }),
}));

export const viewportResultBlobsRelations = relations(
  viewportResultBlobs,
  ({ one }) => ({
    viewportResult: one(viewportResults, {
      fields: [viewportResultBlobs.viewportResultId],
      references: [viewportResults.id],
    }),
  }),
);

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
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  workspaceIdIdx: index('crawls_workspace_id_idx').on(t.workspaceId),
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

// ── AI usage tracking ────────────────────────────────────────────────────────
// A row is written after every completed AI call (analysis or remediation)
// so per-scan / per-workspace cost can be reported without guessing. Column
// cost_usd is estimated client-side from token usage + pricing table.
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id'),
  scanId: uuid('scan_id'),
  provider: text('provider').notNull(),           // 'claude' | 'openai'
  model: text('model').notNull(),
  operation: text('operation').notNull(),         // 'analyze' | 'remediate'
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  imageTokens: integer('image_tokens'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  durationMs: integer('duration_ms'),
  errored: boolean('errored').notNull().default(false),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  scanIdIdx: index('ai_usage_scan_id_idx').on(t.scanId),
  workspaceIdIdx: index('ai_usage_workspace_id_idx').on(t.workspaceId),
  createdAtIdx: index('ai_usage_created_at_idx').on(sql`${t.createdAt} DESC`),
}));
