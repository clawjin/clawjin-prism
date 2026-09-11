CREATE TYPE "public"."attribution_source" AS ENUM('meta', 'google', 'tiktok', 'email', 'organic', 'direct', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'active', 'paused', 'error', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'refunded', 'partially_refunded', 'cancelled', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'starter', 'growth', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('shopify', 'meta', 'google', 'tiktok', 'klaviyo');--> statement-breakpoint
CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."sync_job_type" AS ENUM('historical', 'incremental', 'webhook');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_ad_spend" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text DEFAULT '' NOT NULL,
	"adset_id" text,
	"adset_name" text,
	"ad_id" text,
	"ad_name" text,
	"spend_date" date NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"conversions" bigint DEFAULT 0 NOT NULL,
	"conversion_value_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"external_account_id" text,
	"shop_domain" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text[],
	"last_sync_at" timestamp with time zone,
	"sync_cursor" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_hash" text NOT NULL,
	"email" text,
	"name" text DEFAULT '' NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_spent_cents" integer DEFAULT 0 NOT NULL,
	"acquisition_source" "attribution_source" DEFAULT 'unknown' NOT NULL,
	"segment" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" "platform",
	"metrics_date" date NOT NULL,
	"gross_revenue_cents" integer DEFAULT 0 NOT NULL,
	"net_revenue_cents" integer DEFAULT 0 NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"new_customer_count" integer DEFAULT 0 NOT NULL,
	"returning_customer_count" integer DEFAULT 0 NOT NULL,
	"ad_spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"conversions" bigint DEFAULT 0 NOT NULL,
	"roas_scaled" integer DEFAULT 0 NOT NULL,
	"aov_cents" integer DEFAULT 0 NOT NULL,
	"ctr_basis_points" integer DEFAULT 0 NOT NULL,
	"cpc_cents" integer DEFAULT 0 NOT NULL,
	"cac_cents" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"external_order_id" text NOT NULL,
	"order_number" text,
	"status" "order_status" NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"net_revenue_cents" integer DEFAULT 0 NOT NULL,
	"attribution_source" "attribution_source" DEFAULT 'unknown' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"fbclid" text,
	"customer_email_hash" text,
	"external_customer_id" text,
	"is_first_order" boolean DEFAULT false NOT NULL,
	"line_items_count" integer DEFAULT 0 NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"event_type" text NOT NULL,
	"external_id" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"type" "sync_job_type" NOT NULL,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"date_range_start" date,
	"date_range_end" date,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_total" integer,
	"resume_cursor" jsonb,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"connection_id" integer,
	"platform" "platform" NOT NULL,
	"topic" text NOT NULL,
	"external_id" text,
	"payload" jsonb NOT NULL,
	"hmac_verified" boolean DEFAULT false NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_ad_spend" ADD CONSTRAINT "normalized_ad_spend_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_ad_spend" ADD CONSTRAINT "normalized_ad_spend_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_customers" ADD CONSTRAINT "normalized_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_orders" ADD CONSTRAINT "normalized_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_orders" ADD CONSTRAINT "normalized_orders_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_connection_id_platform_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_spend_user_id_idx" ON "normalized_ad_spend" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ad_spend_date_idx" ON "normalized_ad_spend" USING btree ("spend_date");--> statement-breakpoint
CREATE INDEX "ad_spend_platform_idx" ON "normalized_ad_spend" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "ad_spend_user_date_idx" ON "normalized_ad_spend" USING btree ("user_id","spend_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_spend_unique" ON "normalized_ad_spend" USING btree ("user_id","platform","campaign_id","spend_date");--> statement-breakpoint
CREATE INDEX "connections_user_id_idx" ON "platform_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connections_user_platform_idx" ON "platform_connections" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_unique" ON "normalized_customers" USING btree ("user_id","email_hash");--> statement-breakpoint
CREATE INDEX "customers_user_id_idx" ON "normalized_customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_segment_idx" ON "normalized_customers" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "daily_metrics_user_id_idx" ON "daily_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_metrics_date_idx" ON "daily_metrics" USING btree ("metrics_date");--> statement-breakpoint
CREATE INDEX "daily_metrics_user_date_idx" ON "daily_metrics" USING btree ("user_id","metrics_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metrics_unique" ON "daily_metrics" USING btree ("user_id","metrics_date","platform");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "normalized_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_ordered_at_idx" ON "normalized_orders" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX "orders_attribution_idx" ON "normalized_orders" USING btree ("attribution_source");--> statement-breakpoint
CREATE INDEX "orders_user_time_idx" ON "normalized_orders" USING btree ("user_id","ordered_at");--> statement-breakpoint
CREATE INDEX "orders_user_status_idx" ON "normalized_orders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "orders_user_email_idx" ON "normalized_orders" USING btree ("user_id","customer_email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_unique" ON "normalized_orders" USING btree ("user_id","platform","external_order_id");--> statement-breakpoint
CREATE INDEX "raw_events_user_id_idx" ON "raw_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "raw_events_connection_idx" ON "raw_events" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_events_unique" ON "raw_events" USING btree ("user_id","platform","external_id","event_type");--> statement-breakpoint
CREATE INDEX "raw_events_processed_idx" ON "raw_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_user_id_idx" ON "sync_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_connection_idx" ON "sync_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_jobs_claim_idx" ON "sync_jobs" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "webhook_events_user_id_idx" ON "webhook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "webhook_events_platform_idx" ON "webhook_events" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_dedupe_idx" ON "webhook_events" USING btree ("platform","topic","external_id") WHERE external_id IS NOT NULL;