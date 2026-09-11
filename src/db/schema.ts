// src/db/schema.ts
// Clawjin Prism — Complete Multi-Tenant Analytics Schema
// Every money value stored as INTEGER CENTS — never float
// Every table has userId for tenant isolation

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// ENUMS — strict types, no random strings
// ---------------------------------------------------------------------------

// REPLACE WITH:
export const planEnum = pgEnum("plan", [
  "trial",
  "starter",
  "growth",
  "pro",         
  "enterprise",
]);

export const platformEnum = pgEnum("platform", [
  "shopify",
  "meta",
  "google",
  "tiktok",
  "klaviyo",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "pending",      // OAuth started, not complete
  "active",       // Connected and syncing
  "paused",       // User paused
  "error",        // Token expired or API error
  "revoked",      // User disconnected
]);

export const syncJobTypeEnum = pgEnum("sync_job_type", [
  "historical",   // First time sync — get all past data
  "incremental",  // Regular sync — get new data since last sync
  "webhook",      // Triggered by webhook event
]);

export const syncJobStatusEnum = pgEnum("sync_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "retrying",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "refunded",
  "partially_refunded",
  "cancelled",
  "fulfilled",
]);

export const attributionSourceEnum = pgEnum("attribution_source", [
  "meta",         // Came from Meta/Facebook Ad
  "google",       // Came from Google Ad
  "tiktok",       // Came from TikTok Ad
  "email",        // Came from Email campaign
  "organic",      // SEO / unpaid social
  "direct",       // Typed URL directly
  "unknown",      // No attribution data
]);

// ---------------------------------------------------------------------------
// USERS — One row per business account
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id:                     serial("id").primaryKey(),
  email:                  text("email").notNull().unique(),
  passwordHash:           text("password_hash").notNull(),
  name:                   text("name").notNull(),
  companyName:            text("company_name").notNull().default(""),
  plan:                   planEnum("plan").notNull().default("trial"),
  trialEndsAt:            timestamp("trial_ends_at", { withTimezone: true }),
  stripeCustomerId:       text("stripe_customer_id"),
  stripeSubscriptionId:   text("stripe_subscription_id"),
  createdAt:              timestamp("created_at", { withTimezone: true })
                            .notNull()
                            .defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true })
                            .notNull()
                            .defaultNow(),
});

// ---------------------------------------------------------------------------
// SESSIONS — Refresh token storage (access tokens are stateless JWT)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id")
                  .notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  // Hashed refresh token — never store plain token
  tokenHash:    text("token_hash").notNull().unique(),
  expiresAt:    timestamp("expires_at", { withTimezone: true }).notNull(),
  // Track device for security
  userAgent:    text("user_agent"),
  ipAddress:    text("ip_address"),
  createdAt:    timestamp("created_at", { withTimezone: true })
                  .notNull()
                  .defaultNow(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// ---------------------------------------------------------------------------
// PLATFORM CONNECTIONS — OAuth credentials per user per platform
// THIS IS THE MOST SECURITY-CRITICAL TABLE
// ---------------------------------------------------------------------------

export const platformConnections = pgTable("platform_connections", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id")
                          .notNull()
                          .references(() => users.id, { onDelete: "cascade" }),
  platform:             platformEnum("platform").notNull(),
  status:               connectionStatusEnum("status").notNull().default("pending"),

  // Display info
  displayName:          text("display_name").notNull().default(""),
  // For Shopify: "mystore.myshopify.com"
  // For Meta: Ad Account ID "act_123456789"
  externalAccountId:    text("external_account_id"),
  shopDomain:           text("shop_domain"), // Shopify only

  // OAuth tokens — AES-256-GCM encrypted, NEVER stored plain
  // Format: "iv:authTag:encryptedData" all in hex
  accessTokenEncrypted:   text("access_token_encrypted"),
  refreshTokenEncrypted:  text("refresh_token_encrypted"),
  tokenExpiresAt:         timestamp("token_expires_at", { withTimezone: true }),
  // Permissions granted by merchant
  scopes:               text("scopes").array(),

  // Sync state
  lastSyncAt:           timestamp("last_sync_at", { withTimezone: true }),
  // JSON cursor for resuming paginated sync
  // e.g. { "page_info": "abc123", "lastOrderId": 99999 }
  syncCursor:           jsonb("sync_cursor"),
  // Error message if status = "error"
  errorMessage:         text("error_message"),

  createdAt:            timestamp("created_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
}, (table) => ({
  userIdIdx:      index("connections_user_id_idx").on(table.userId),
  // Multi-connection support: same user may connect several stores/ad
  // accounts per platform. Composite index keeps tenant lookups fast.
  userPlatformIdx: index("connections_user_platform_idx")
                     .on(table.userId, table.platform),
}));

// ---------------------------------------------------------------------------
// SYNC JOBS — Track every sync operation, enable resume on failure
// ---------------------------------------------------------------------------

export const syncJobs = pgTable("sync_jobs", {
  id:                 serial("id").primaryKey(),
  userId:             integer("user_id")
                        .notNull()
                        .references(() => users.id, { onDelete: "cascade" }),
  connectionId:       integer("connection_id")
                        .notNull()
                        .references(() => platformConnections.id, { onDelete: "cascade" }),
  type:               syncJobTypeEnum("type").notNull(),
  status:             syncJobStatusEnum("status").notNull().default("pending"),

  // Date range this job covers
  dateRangeStart:     date("date_range_start"),
  dateRangeEnd:       date("date_range_end"),

  // Progress tracking
  recordsProcessed:   integer("records_processed").notNull().default(0),
  recordsTotal:       integer("records_total"),
  // Where to resume if this job fails mid-way
  resumeCursor:       jsonb("resume_cursor"),

  // Error info
  errorMessage:       text("error_message"),
  attemptCount:       integer("attempt_count").notNull().default(0),
  maxAttempts:        integer("max_attempts").notNull().default(5),
  nextRetryAt:        timestamp("next_retry_at", { withTimezone: true }),

  startedAt:          timestamp("started_at", { withTimezone: true }),
  completedAt:        timestamp("completed_at", { withTimezone: true }),
  createdAt:          timestamp("created_at", { withTimezone: true })
                        .notNull()
                        .defaultNow(),
}, (table) => ({
  userIdIdx:      index("sync_jobs_user_id_idx").on(table.userId),
  connectionIdx:  index("sync_jobs_connection_idx").on(table.connectionId),
  statusIdx:      index("sync_jobs_status_idx").on(table.status),
  // Worker claim query: pending/retrying jobs ordered by retry time
  claimIdx:       index("sync_jobs_claim_idx").on(table.status, table.nextRetryAt),
}));

// ---------------------------------------------------------------------------
// RAW EVENTS — Exact API response stored forever
// If our normalization has a bug → reprocess from here
// This is our source of truth
// ---------------------------------------------------------------------------

export const rawEvents = pgTable("raw_events", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id")
                    .notNull()
                    .references(() => users.id, { onDelete: "cascade" }),
  connectionId:   integer("connection_id")
                    .notNull()
                    .references(() => platformConnections.id, { onDelete: "cascade" }),
  platform:       platformEnum("platform").notNull(),
  eventType:      text("event_type").notNull(), // "order", "ad_spend", "product"
  // Platform's own ID for this record
  externalId:     text("external_id").notNull(),
  // Exact JSON response from platform API — never modified
  rawPayload:     jsonb("raw_payload").notNull(),
  // Whether this has been processed into normalized tables
  processed:      boolean("processed").notNull().default(false),
  processedAt:    timestamp("processed_at", { withTimezone: true }),
  ingestedAt:     timestamp("ingested_at", { withTimezone: true })
                    .notNull()
                    .defaultNow(),
}, (table) => ({
  userIdIdx:        index("raw_events_user_id_idx").on(table.userId),
  connectionIdx:    index("raw_events_connection_idx").on(table.connectionId),
  // Prevent duplicate ingestion of same event
  uniqueEvent:      uniqueIndex("raw_events_unique")
                      .on(table.userId, table.platform, table.externalId, table.eventType),
  processedIdx:     index("raw_events_processed_idx").on(table.processed),
}));

// ---------------------------------------------------------------------------
// WEBHOOK EVENTS — High volume, separate table for webhooks only
// ---------------------------------------------------------------------------

export const webhookEvents = pgTable("webhook_events", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id")
                    .references(() => users.id, { onDelete: "set null" }),
  connectionId:   integer("connection_id")
                    .references(() => platformConnections.id, { onDelete: "set null" }),
  platform:       platformEnum("platform").notNull(),
  topic:          text("topic").notNull(), // "orders/create", "orders/updated"
  // Platform's ID for deduplication
  externalId:     text("external_id"),
  // Raw webhook payload
  payload:        jsonb("payload").notNull(),
  // HMAC verified before accepting
  hmacVerified:   boolean("hmac_verified").notNull().default(false),
  processed:      boolean("processed").notNull().default(false),
  // If processing failed, why
  errorMessage:   text("error_message"),
  receivedAt:     timestamp("received_at", { withTimezone: true })
                    .notNull()
                    .defaultNow(),
  processedAt:    timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  userIdIdx:      index("webhook_events_user_id_idx").on(table.userId),
  processedIdx:   index("webhook_events_processed_idx").on(table.processed),
  platformIdx:    index("webhook_events_platform_idx").on(table.platform),
  // Deduplication: Shopify retries webhooks aggressively.
  // Partial unique index — only rows with an external id participate.
  dedupeIdx:      uniqueIndex("webhook_events_dedupe_idx")
                    .on(table.platform, table.topic, table.externalId)
                    .where(sql`external_id IS NOT NULL`),
}));

// ---------------------------------------------------------------------------
// NORMALIZED ORDERS — Clean, consistent order data from any platform
// ALL MONEY IN INTEGER CENTS — never float
// ---------------------------------------------------------------------------

export const normalizedOrders = pgTable("normalized_orders", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id")
                          .notNull()
                          .references(() => users.id, { onDelete: "cascade" }),
  connectionId:         integer("connection_id")
                          .notNull()
                          .references(() => platformConnections.id, { onDelete: "cascade" }),
  platform:             platformEnum("platform").notNull(),

  // Platform's own order ID — for deduplication
  externalOrderId:      text("external_order_id").notNull(),
  orderNumber:          text("order_number"),
  status:               orderStatusEnum("status").notNull(),
  currency:             text("currency").notNull().default("USD"),

  // ALL AMOUNTS IN CENTS (integer)
  // $150.00 → stored as 15000
  // Never use float for money
  subtotalCents:        integer("subtotal_cents").notNull().default(0),
  discountCents:        integer("discount_cents").notNull().default(0),
  shippingCents:        integer("shipping_cents").notNull().default(0),
  taxCents:             integer("tax_cents").notNull().default(0),
  totalCents:           integer("total_cents").notNull().default(0),
  refundedCents:        integer("refunded_cents").notNull().default(0),

  // Net revenue = total - refunded (what merchant actually keeps)
  netRevenueCents:      integer("net_revenue_cents").notNull().default(0),

  // Attribution — which channel brought this customer
  attributionSource:    attributionSourceEnum("attribution_source")
                          .notNull()
                          .default("unknown"),
  // UTM parameters from Shopify order
  utmSource:            text("utm_source"),
  utmMedium:            text("utm_medium"),
  utmCampaign:          text("utm_campaign"),
  // Meta's own click ID for attribution matching
  fbclid:               text("fbclid"),

  // Customer info (email hashed for privacy)
  customerEmailHash:    text("customer_email_hash"),
  externalCustomerId:   text("external_customer_id"),
  isFirstOrder:         boolean("is_first_order").notNull().default(false),

  // Product count
  lineItemsCount:       integer("line_items_count").notNull().default(0),

  // When order was placed (platform time, converted to UTC)
  orderedAt:            timestamp("ordered_at", { withTimezone: true }).notNull(),
  createdAt:            timestamp("created_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
}, (table) => ({
  userIdIdx:        index("orders_user_id_idx").on(table.userId),
  orderedAtIdx:     index("orders_ordered_at_idx").on(table.orderedAt),
  attributionIdx:   index("orders_attribution_idx").on(table.attributionSource),
  // Composite tenant+time index — dashboard windows and aggregation scans
  userTimeIdx:      index("orders_user_time_idx").on(table.userId, table.orderedAt),
  userStatusIdx:    index("orders_user_status_idx").on(table.userId, table.status),
  userEmailIdx:     index("orders_user_email_idx").on(table.userId, table.customerEmailHash),
  // Prevent duplicate orders from same platform
  uniqueOrder:      uniqueIndex("orders_unique")
                      .on(table.userId, table.platform, table.externalOrderId),
}));

// ---------------------------------------------------------------------------
// NORMALIZED AD SPEND — Daily ad metrics from Meta, Google, TikTok
// ALL MONEY IN INTEGER CENTS
// ---------------------------------------------------------------------------

export const normalizedAdSpend = pgTable("normalized_ad_spend", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id")
                          .notNull()
                          .references(() => users.id, { onDelete: "cascade" }),
  connectionId:         integer("connection_id")
                          .notNull()
                          .references(() => platformConnections.id, { onDelete: "cascade" }),
  platform:             platformEnum("platform").notNull(),

  // Campaign hierarchy
  campaignId:           text("campaign_id").notNull(),
  campaignName:         text("campaign_name").notNull().default(""),
  adsetId:              text("adset_id"),
  adsetName:            text("adset_name"),
  adId:                 text("ad_id"),
  adName:               text("ad_name"),

  // This row covers exactly one calendar day
  spendDate:            date("spend_date").notNull(),
  currency:             text("currency").notNull().default("USD"),

  // All spend in cents
  spendCents:           integer("spend_cents").notNull().default(0),

  // Performance metrics — BIGINT: aggregate counters can overflow int4
  // (2.1B impressions is realistic for large ad accounts)
  impressions:          bigint("impressions", { mode: "number" }).notNull().default(0),
  clicks:               bigint("clicks", { mode: "number" }).notNull().default(0),
  // Conversions reported by platform (Meta's own attribution)
  conversions:          bigint("conversions", { mode: "number" }).notNull().default(0),
  // Platform-reported conversion value in cents
  conversionValueCents: bigint("conversion_value_cents", { mode: "number" }).notNull().default(0),

  createdAt:            timestamp("created_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
}, (table) => ({
  userIdIdx:      index("ad_spend_user_id_idx").on(table.userId),
  spendDateIdx:   index("ad_spend_date_idx").on(table.spendDate),
  platformIdx:    index("ad_spend_platform_idx").on(table.platform),
  userDateIdx:    index("ad_spend_user_date_idx").on(table.userId, table.spendDate),
  // One row per campaign per day — upsert on this
  uniqueSpend:    uniqueIndex("ad_spend_unique")
                    .on(table.userId, table.platform, table.campaignId, table.spendDate),
}));

// ---------------------------------------------------------------------------
// DAILY METRICS — Pre-calculated, dashboard reads from here (fast)
// Recalculated every hour by background job
// ---------------------------------------------------------------------------

export const dailyMetrics = pgTable("daily_metrics", {
  id:                     serial("id").primaryKey(),
  userId:                 integer("user_id")
                            .notNull()
                            .references(() => users.id, { onDelete: "cascade" }),
  // Which platform this covers (null = combined/all platforms)
  platform:               platformEnum("platform"),
  metricsDate:            date("metrics_date").notNull(),

  // Revenue metrics (cents)
  grossRevenueCents:      integer("gross_revenue_cents").notNull().default(0),
  netRevenueCents:        integer("net_revenue_cents").notNull().default(0),
  refundedCents:          integer("refunded_cents").notNull().default(0),
  orderCount:             integer("order_count").notNull().default(0),
  newCustomerCount:       integer("new_customer_count").notNull().default(0),
  returningCustomerCount: integer("returning_customer_count").notNull().default(0),

  // Ad metrics (cents + BIGINT counters)
  adSpendCents:           integer("ad_spend_cents").notNull().default(0),
  impressions:            bigint("impressions", { mode: "number" }).notNull().default(0),
  clicks:                 bigint("clicks", { mode: "number" }).notNull().default(0),
  conversions:            bigint("conversions", { mode: "number" }).notNull().default(0),

  // Derived metrics (stored as scaled integers to avoid float)
  // ROAS: stored as (roas * 100) — so 12.5x ROAS = stored as 1250
  roasScaled:             integer("roas_scaled").notNull().default(0),
  // AOV in cents
  aovCents:               integer("aov_cents").notNull().default(0),
  // CTR: stored as (ctr * 10000) basis points — 4.5% = 450
  ctrBasisPoints:         integer("ctr_basis_points").notNull().default(0),
  // CPC in cents
  cpcCents:               integer("cpc_cents").notNull().default(0),
  // CAC in cents
  cacCents:               integer("cac_cents").notNull().default(0),

  // When this row was last recalculated
  computedAt:             timestamp("computed_at", { withTimezone: true })
                            .notNull()
                            .defaultNow(),
}, (table) => ({
  userIdIdx:        index("daily_metrics_user_id_idx").on(table.userId),
  dateIdx:          index("daily_metrics_date_idx").on(table.metricsDate),
  // Composite tenant+date — the dashboard's hot read path
  userDateIdx:      index("daily_metrics_user_date_idx")
                      .on(table.userId, table.metricsDate),
  // One row per user per platform per date
  // (platform NULL = blended row across all platforms)
  uniqueMetrics:    uniqueIndex("daily_metrics_unique")
                      .on(table.userId, table.metricsDate, table.platform),
}));

// ---------------------------------------------------------------------------
// CUSTOMERS — Unified customer view across all platforms
// ---------------------------------------------------------------------------

export const normalizedCustomers = pgTable("normalized_customers", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id")
                          .notNull()
                          .references(() => users.id, { onDelete: "cascade" }),
  // Hashed email is the universal customer identifier across platforms
  emailHash:            text("email_hash").notNull(),
  // Keep original for display (encrypted in production)
  email:                text("email"),
  name:                 text("name").notNull().default(""),

  // RFM Data (Recency, Frequency, Monetary)
  firstOrderAt:         timestamp("first_order_at", { withTimezone: true }),
  lastOrderAt:          timestamp("last_order_at", { withTimezone: true }),
  orderCount:           integer("order_count").notNull().default(0),
  // Total spend in cents
  totalSpentCents:      integer("total_spent_cents").notNull().default(0),

  // Which channel acquired this customer
  acquisitionSource:    attributionSourceEnum("acquisition_source")
                          .notNull()
                          .default("unknown"),

  // Segment computed from RFM
  segment:              text("segment").notNull().default("new"),

  createdAt:            timestamp("created_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true })
                          .notNull()
                          .defaultNow(),
}, (table) => ({
  // One customer per email hash per user account
  uniqueCustomer:   uniqueIndex("customers_unique").on(table.userId, table.emailHash),
  userIdIdx:        index("customers_user_id_idx").on(table.userId),
  segmentIdx:       index("customers_segment_idx").on(table.segment),
}));

// ---------------------------------------------------------------------------
// PAYMENTS — Billing (keep existing, fix amount to cents)
// ---------------------------------------------------------------------------

export const payments = pgTable("payments", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id")
                  .notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  // Amount in cents — $29.99 = 2999
  amountCents:  integer("amount_cents").notNull(),
  currency:     text("currency").notNull().default("usd"),
  status:       text("status").notNull().default("paid"),
  provider:     text("provider").notNull().default("stripe"),
  providerId:   text("provider_id"),
  createdAt:    timestamp("created_at", { withTimezone: true })
                  .notNull()
                  .defaultNow(),
});

// ---------------------------------------------------------------------------
// ALERTS — Keep existing, it's fine
// ---------------------------------------------------------------------------

export const alerts = pgTable("alerts", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id")
                  .notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  title:        text("title").notNull(),
  message:      text("message").notNull(),
  severity:     text("severity").notNull().default("info"),
  read:         boolean("read").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true })
                  .notNull()
                  .defaultNow(),
});

// ---------------------------------------------------------------------------
// ACTIVITY LOG — Keep existing, it's fine
// ---------------------------------------------------------------------------

export const activityLog = pgTable("activity_log", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id")
                  .notNull()
                  .references(() => users.id, { onDelete: "cascade" }),
  action:       text("action").notNull(),
  detail:       text("detail").notNull().default(""),
  createdAt:    timestamp("created_at", { withTimezone: true })
                  .notNull()
                  .defaultNow(),
});

// ---------------------------------------------------------------------------
// TYPE EXPORTS — Use these everywhere, never raw table types
// ---------------------------------------------------------------------------

export type User                  = typeof users.$inferSelect;
export type NewUser               = typeof users.$inferInsert;
export type Session               = typeof sessions.$inferSelect;
export type PlatformConnection    = typeof platformConnections.$inferSelect;
export type NewPlatformConnection = typeof platformConnections.$inferInsert;
export type SyncJob               = typeof syncJobs.$inferSelect;
export type NewSyncJob            = typeof syncJobs.$inferInsert;
export type RawEvent              = typeof rawEvents.$inferSelect;
export type WebhookEvent          = typeof webhookEvents.$inferSelect;
export type NormalizedOrder       = typeof normalizedOrders.$inferSelect;
export type NewNormalizedOrder    = typeof normalizedOrders.$inferInsert;
export type NormalizedAdSpend     = typeof normalizedAdSpend.$inferSelect;
export type NewNormalizedAdSpend  = typeof normalizedAdSpend.$inferInsert;
export type DailyMetrics          = typeof dailyMetrics.$inferSelect;
export type NormalizedCustomer    = typeof normalizedCustomers.$inferSelect;
export type Alert                 = typeof alerts.$inferSelect;
export type Payment               = typeof payments.$inferSelect;

// ---------------------------------------------------------------------------
// BACKWARD COMPATIBILITY ALIASES
// Old code references these names — we keep them working
// Gradually migrate files to use new names
// ---------------------------------------------------------------------------

// Old name → New name mappings
export const connections        = platformConnections;
export const orders             = normalizedOrders;
export const customers          = normalizedCustomers;
export const adSpend            = normalizedAdSpend;

// Old type aliases
export type Connection          = PlatformConnection;
export type Order               = NormalizedOrder;
export type Customer            = NormalizedCustomer;
export type AdSpendRow          = NormalizedAdSpend;