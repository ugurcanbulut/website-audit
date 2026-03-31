import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Scans ────────────────────────────────────────────────────────────────────

export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  status: text('status').notNull().default('pending'),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiProvider: text('ai_provider'),
  viewports: jsonb('viewports').notNull(),
  overallScore: integer('overall_score'),
  overallGrade: text('overall_grade'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const scansRelations = relations(scans, ({ many }) => ({
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
});

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
});

export const categoryScoresRelations = relations(categoryScores, ({ one }) => ({
  scan: one(scans, {
    fields: [categoryScores.scanId],
    references: [scans.id],
  }),
}));
