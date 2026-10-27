import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SearchStage } from "@/lib/pipeline/stages";

export type SearchStatus = "queued" | "running" | "done" | "failed";

export interface SearchProgress {
  stage: SearchStage;
  counts: {
    queries: number;
    hits: number;
    fetchedPages: number;
    classified: number;
    claimsDropped: number;
    matched: number;
    ruledOut: number;
  };
  timingsMs: Partial<Record<string, number>>;
  costs: { searchCredits: number; searchCostUsd?: number; aiCalls: number; aiInputTokens: number; aiOutputTokens: number };
  /** Per discovery source: queries run, results returned, and results no other source found. */
  sourceStats: Partial<Record<string, { queries: number; hits: number; onlyHere: number }>>;
  sourceErrors: { source: string; message: string }[];
  classifier: string;
  searchProvider: string;
}

export interface CountrySignal {
  type: "phone" | "city" | "tld" | "job_board" | "ai";
  value: string;
  country: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface ScoreReason {
  signal: string;
  label: string;
  points: number;
  evidenceIds: string[];
}

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const searches = pgTable(
  "searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    country: text("country").notNull(),
    market: text("market").notNull(),
    campaign: text("campaign").notNull(),
    depth: text("depth").notNull(),
    status: text("status").$type<SearchStatus>().notNull().default("queued"),
    progress: jsonb("progress").$type<SearchProgress>().notNull(),
    error: text("error"),
    ipHash: text("ip_hash").notNull(),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("searches_filters_idx").on(t.country, t.market, t.campaign, t.depth, t.createdAt),
    index("searches_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

export const centers = pgTable(
  "centers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    entityType: text("entity_type").notNull(),
    /** Registered domain of the center's own website. Many centers have none. */
    domain: text("domain"),
    websiteUrl: text("website_url"),
    websiteStatus: text("website_status").$type<"ok" | "js_only" | "blocked" | "dead" | "none">().notNull().default("none"),
    phones: text("phones").array().notNull().default(sql`'{}'::text[]`),
    emails: text("emails").array().notNull().default(sql`'{}'::text[]`),
    country: text("country"),
    countrySignals: jsonb("country_signals").$type<CountrySignal[]>().notNull().default([]),
    city: text("city"),
    socialLinks: jsonb("social_links").$type<SocialLink[]>().notNull().default([]),
    summary: text("summary"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** When anything last read this center: a search or a re-check. */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
    /** When someone last pressed "Re-check now"; limits how often that can run. */
    recheckedAt: timestamp("rechecked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("centers_domain_idx").on(t.domain),
    index("centers_name_trgm_idx").using("gin", sql`${t.normalizedName} gin_trgm_ops`),
    index("centers_phones_idx").using("gin", t.phones),
  ],
);

export type EvidenceKind =
  | "campaign"
  | "hiring"
  | "market"
  | "country"
  | "compliance"
  | "red_flag"
  | "us_hours"
  | "entity"
  | "listing";

export type EvidenceSource = "website" | "job_board" | "social" | "vendor_marketplace" | "directory" | "search_result";

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centerId: uuid("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    searchId: uuid("search_id").references(() => searches.id, { onDelete: "set null" }),
    kind: text("kind").$type<EvidenceKind>().notNull(),
    /** Campaign id, market id, country id, signal name, or entity type. */
    value: text("value").notNull(),
    campaignRole: text("campaign_role"),
    quote: text("quote").notNull(),
    matchType: text("match_type").$type<"exact" | "normalized">().notNull(),
    sourceUrl: text("source_url").notNull(),
    source: text("source").$type<EvidenceSource>().notNull(),
    /** Which resolve rule attached this evidence to the center. */
    mergeRule: text("merge_rule").$type<"new" | "domain" | "phone" | "name_city">().notNull(),
    classifier: text("classifier").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evidence_center_idx").on(t.centerId),
    uniqueIndex("evidence_dedupe_idx").on(t.centerId, t.kind, t.value, t.sourceUrl, t.quote),
  ],
);

export const searchResults = pgTable(
  "search_results",
  {
    searchId: uuid("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    centerId: uuid("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    /** Score with default settings; the UI re-scores at read time. */
    fitScore: integer("fit_score").notNull(),
    label: text("label").$type<"high" | "medium" | "low">().notNull(),
    reasons: jsonb("reasons").$type<ScoreReason[]>().notNull(),
    fromEarlierSearch: integer("from_earlier_search").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.searchId, t.centerId] }), index("search_results_score_idx").on(t.searchId, t.fitScore)],
);

export const ruledOut = pgTable(
  "ruled_out",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    searchId: uuid("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    name: text("name"),
    reason: text("reason").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("ruled_out_search_idx").on(t.searchId)],
);

export const pageCache = pgTable("page_cache", {
  url: text("url").primaryKey(),
  status: text("status").$type<"ok" | "js_only" | "blocked" | "robots" | "error">().notNull(),
  title: text("title"),
  text: text("text"),
  contentHash: text("content_hash"),
  /** Structured facts read without AI (JSON-LD, phones, emails, links). */
  extracted: jsonb("extracted"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classificationCache = pgTable(
  "classification_cache",
  {
    contentHash: text("content_hash").notNull(),
    classifier: text("classifier").notNull(),
    result: jsonb("result").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.contentHash, t.classifier] })],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centerId: uuid("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    searchId: uuid("search_id").references(() => searches.id, { onDelete: "set null" }),
    verdict: text("verdict").$type<"fit" | "not_fit">().notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_center_idx").on(t.centerId)],
);

export type Search = typeof searches.$inferSelect;
export type Center = typeof centers.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;
