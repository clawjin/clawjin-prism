import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Clawjin Prism™ — PostgreSQL schema
// Workspace = everything owned by a single authenticated user.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull().default(""),
  plan: text("plan").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Payment / billing history (Stripe + demo-mode records).
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull().default("paid"),
  provider: text("provider").notNull().default("stripe"),
  providerId: text("provider_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Data source integrations (Shopify, Meta, Google, TikTok, Klaviyo).
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("connected"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Raw transactional orders ingested by the engine.
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customerId: integer("customer_id"),
  orderNumber: text("order_number").notNull(),
  revenue: doublePrecision("revenue").notNull(),
  cogs: doublePrecision("cogs").notNull(),
  shipping: doublePrecision("shipping").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("paid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Multi-channel paid media spend (daily grain).
export const adSpend = pgTable("ad_spend", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  spend: doublePrecision("spend").notNull(),
  impressions: integer("impressions").notNull(),
  clicks: integer("clicks").notNull(),
  conversions: integer("conversions").notNull(),
});

// Customer master with RFM attributes (recency / frequency / monetary).
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  firstOrderAt: timestamp("first_order_at", { withTimezone: true }).notNull(),
  lastOrderAt: timestamp("last_order_at", { withTimezone: true }).notNull(),
  orderCount: integer("order_count").notNull().default(1),
  totalSpend: doublePrecision("total_spend").notNull().default(0),
  segment: text("segment").notNull().default("new"),
});

// Executive briefing alerts.
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Audit trail of activity inside a workspace.
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type AdSpendRow = typeof adSpend.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Payment = typeof payments.$inferSelect;
