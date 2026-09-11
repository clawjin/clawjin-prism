PROJECT OVERVIEW
What We're Building
A multi-tenant analytics platform that connects Shopify stores and Meta Ads accounts into one unified dashboard. Business owners log in, connect their platforms via OAuth, and see all their sales and advertising data in one place with accurate cross-platform calculations.

The Core Problem We Solve
Right now, e-commerce businesses have to:

Check Shopify for sales data
Check Meta Ads Manager for ad spend
Manually calculate ROAS, CAC, and profit
Use spreadsheets to compare platforms
Can't see which channel is actually profitable
We solve this by pulling all data automatically, normalizing it, and presenting accurate unified metrics.

Unique Value
The dashboard shows blended metrics across platforms. A merchant sees their true ROAS accounting for all ad spend and all revenue, not just what each platform reports in isolation. They see which channel is most efficient, where to shift budget, and their actual profitability.

HOW IT WORKS (USER JOURNEY)
Step 1: Sign Up
Business owner creates account with email and password. They start on a 14-day free trial. No credit card required.

Step 2: Connect Platforms
User clicks "Connect Shopify" button. They're redirected to Shopify OAuth flow, approve permissions, redirected back. Our system stores their encrypted access token.

Same process for Meta Ads - OAuth flow, approval, token storage.

Step 3: Sync Historical Data
After connecting, user clicks "Sync Data" and chooses date range:

Last 7 days
Last 30 days
Last 90 days
Custom range
A background job starts fetching their orders from Shopify and ad spend from Meta. Progress shown in real-time. Takes 2-10 minutes depending on data volume.

Step 4: View Dashboard
Once sync completes, dashboard shows:

Total revenue across all platforms
Total ad spend across all platforms
Blended ROAS
Order count, AOV, CAC
Revenue trend chart (last 60 days)
Channel comparison (Shopify vs Meta vs Google)
Customer segments (VIP, loyal, at-risk, etc.)
Cohort retention matrix
All metrics update automatically. Real-time webhooks keep data fresh without manual syncing.

Step 5: Ongoing Updates
Every hour, new orders pulled automatically
Webhooks update data in real-time when orders placed
Daily aggregation job recalculates all metrics
User sees fresh dashboard every time they log in
SYSTEM ARCHITECTURE (HIGH LEVEL)
Frontend Layer
Next.js application with dashboard pages, charts, tables, connection management UI. Users interact here.

API Layer
Next.js API routes handle:

Authentication (login, signup, logout)
OAuth flows (Shopify, Meta)
Connection management (view, disconnect)
Sync triggers (start historical sync)
Analytics endpoints (dashboard data)
Webhook receivers (Shopify sends order updates)
Business Logic Layer
Modules for each platform (Shopify module, Meta module) that handle:

OAuth token exchange
API communication
Data fetching with pagination
Rate limit handling
Data normalization
Queue System
Redis-based job queue that manages:

Historical sync jobs (fetch past data)
Incremental sync jobs (fetch new data daily)
Webhook processing jobs (process real-time events)
Aggregation jobs (compute daily metrics)
Jobs go into priority queues. High priority = webhooks (process immediately). Normal priority = regular syncs. Low priority = heavy aggregations.

Worker System
Background processes that:

Pick jobs from queue
Execute them (fetch data, normalize, aggregate)
Handle retries if API fails
Update job status
Alert user on completion or failure
Workers run on serverless functions triggered by cron schedules or manual API calls.

Data Storage Layer
PostgreSQL database with tables for:

Users and sessions
Platform connections and OAuth tokens
Sync job tracking
Raw API responses (source of truth, never modified)
Normalized order data (clean, consistent format)
Normalized ad spend data (clean, consistent format)
Customer profiles
Daily pre-computed metrics (for fast dashboard queries)
Alerts and activity logs
Redis cache for:

Job queue storage
Rate limit counters
Session tokens
Dashboard response caching
DATA FLOW
Ingestion Flow
Platform API sends data → Worker fetches via API → Store exact JSON response in raw events table → Normalization job converts raw JSON to clean structured data → Aggregation job computes daily metrics from normalized data → Dashboard reads pre-computed metrics

Why This Flow
If we discover a calculation bug later, we have the original raw data. We can fix the normalization logic and reprocess everything without re-fetching from platform APIs.

Real-Time Flow
Shopify sends webhook when order placed → Webhook endpoint receives POST request → Verify signature for security → Store webhook payload → Return success immediately → Enqueue processing job → Worker picks up job → Normalizes order data → Updates aggregates → Dashboard shows new order within 1 minute

KEY TECHNICAL DECISIONS
Decision 1: Single Connection Per Platform
Each user can connect one Shopify store and one Meta ad account. This simplifies the initial version. Multi-store support can be added later if needed.

Decision 2: User Equals Tenant
No team/organization features yet. One user account = one business. Keeps schema simpler for MVP.

Decision 3: Serverless Workers
All background jobs run on Vercel serverless functions triggered by cron schedules. No separate server infrastructure needed. Cost-effective and auto-scales.

Decision 4: Pre-Computed Aggregates
Dashboard never calculates metrics on-demand from raw data. All metrics pre-computed by hourly aggregation jobs and stored in daily metrics table. Dashboards are instant because they just read pre-calculated numbers.

Decision 5: User-Controlled Historical Sync
System doesn't automatically fetch all historical data on connect. User chooses what range to sync. Reduces API usage and gives user control.

Decision 6: Integer Cents for Money
All money values stored as integer cents, never as floating point decimals. Prevents rounding errors. A payment of one hundred fifty dollars is stored as integer 15000, not float 150.00.

Decision 7: Immutable Raw Data
Once an API response is stored in the raw events table, it's never modified or deleted. This creates an audit trail and allows reprocessing if bugs found.

CORE FEATURES
Authentication System
Users sign up with email and password. Password hashed using scrypt. Sessions managed with secure tokens stored as hashes in database. Access tokens are stateless JWT. Refresh tokens stored in database for logout capability.

OAuth Integration
Shopify OAuth flow redirects user to Shopify, they approve permissions, system receives authorization code, exchanges it for access token, encrypts token with AES-256, stores in database. Meta OAuth works the same way.

State tokens prevent CSRF attacks. HMAC signatures verify callback authenticity.

Connection Management
Users see list of connected platforms. Each shows connection status (active, error, paused), last sync time, and platform-specific details like shop domain or ad account ID. Users can disconnect platforms which revokes access and stops syncing.

Historical Data Sync
User initiates sync by choosing date range. System creates sync job in database with pending status. Worker picks up job, fetches data from platform API in chunks to respect rate limits, handles pagination cursors, stores each response in raw events table, tracks progress, updates job status to completed or failed.

If job fails mid-way, cursor position saved so it can resume without starting over. Retries use exponential backoff.

Incremental Sync
Daily cron job fetches data from last 24 hours for all connected platforms. Keeps data fresh without user intervention. Updates existing orders if status changed (like order fulfilled or refunded).

Webhook Processing
Shopify sends webhook when order created, updated, or refunded. System receives POST request, verifies HMAC signature to confirm it's really from Shopify, stores payload immediately, returns 200 response fast (under 5 seconds), then processes async in background worker.

Deduplication logic prevents processing same webhook twice if Shopify sends duplicates.

Data Normalization
Raw API responses are in platform-specific formats. Shopify order JSON looks different from Meta insight JSON. Normalization converts all to consistent internal format.

Shopify order with timestamp in Eastern timezone gets converted to UTC. Shopify money values in dollars get converted to integer cents. Attribution source detected from referrer URLs and UTM parameters. Customer email hashed for privacy.

Meta ad spend data normalized to same structure - campaign ID, date, spend in cents, impressions, clicks, conversions.

Daily Aggregation
Hourly background job computes metrics for each day from normalized data. For each user and each date, calculate total revenue, order count, ad spend, new customer count, returning customer count. Then derive ROAS, AOV, CAC, CPC, CTR.

Store results in daily metrics table. Dashboard queries this table instead of computing on-demand. Fast and consistent.

Analytics Calculations
Revenue calculations sum all paid orders minus refunds. Ad spend sums across all platforms. ROAS is revenue divided by spend. CAC is ad spend divided by new customers acquired (not total orders, only first-time customers). AOV is revenue divided by order count.

Percentage changes calculated by comparing last 14 days to previous 14 days.

Channel breakdown shows per-platform metrics. Meta channel shows only Meta ad spend and Meta-attributed revenue.

Customer Segmentation
System tracks each customer by hashed email. Computes recency (days since last order), frequency (order count), monetary (total spent). Based on RFM analysis, assigns segment like VIP, loyal, at-risk, lost, new.

Dashboard shows segment distribution and lists customers with their segments.

Cohort Analysis
Groups customers by month they first ordered (cohort month). Tracks what percentage of each cohort returns in subsequent months. Displays as retention matrix showing M0 (first month) = 100%, M1 (second month) = 35%, M2 = 18%, etc.

Helps merchant understand repeat purchase rate and customer lifetime value.

Smart Insights
System analyzes metrics and generates plain-English insights like:

"Meta is outperforming Google by 2.5x ROAS"
"Your acquisition cost is down 15% this week"
"January cohort has 28% repeat purchase rate, above your average"
Insights have tone (positive, negative, neutral) and are prioritized by importance.

SECURITY & RELIABILITY
Token Security
All OAuth access tokens encrypted before storage using AES-256-GCM encryption. Encryption keys stored in environment variables, never in code. Tokens decrypted only when making API calls, never logged or exposed in API responses.

Customer emails hashed using HMAC with secret salt. Even if database compromised, plain emails not exposed.

Webhook Security
All incoming webhooks verified by checking HMAC signature. Shopify and Meta both send signature headers. System recomputes signature and compares. Mismatches rejected immediately. Prevents attackers from sending fake webhooks.

OAuth Security
State tokens prevent CSRF attacks during OAuth flows. State generated randomly, stored in Redis with 10-minute expiration, verified on callback. Attackers can't trick users into connecting wrong accounts.

Session Security
Session cookies set with httpOnly (can't be read by JavaScript), secure (HTTPS only), sameSite (prevents CSRF). Tokens hashed before storage. Session expiration enforced.

Rate Limit Handling
Each platform has rate limits. Shopify allows 2 requests per second. Meta allows 200 calls per hour. System tracks usage, sleeps between requests to stay under limit, handles 429 rate limit errors with exponential backoff retry.

Retry Logic
API calls can fail due to network issues or platform outages. System retries up to 5 times with exponential backoff and random jitter. First retry after 1 second, second after 2 seconds, third after 4 seconds, etc. After 5 failures, job moved to dead letter queue and user alerted.

Idempotency
Same order can be fetched multiple times (webhook + polling). System uses unique constraints in database to prevent duplicates. Upsert logic updates existing records instead of creating duplicates.

Data Integrity
All money stored as integers to prevent float rounding errors. All timestamps stored in UTC to prevent timezone bugs. Original currency and timezone stored alongside converted values for reference.

PLATFORM-SPECIFIC DETAILS
Shopify Integration
OAuth scopes needed: read_orders, read_products, read_customers, read_analytics

APIs used:

Orders API for fetching order history
Products API for catalog data
Customers API for customer profiles
Analytics API for traffic and conversion data (future enhancement)
Pagination: Cursor-based. Response includes link header with next page cursor. System extracts cursor and passes to next request.

Webhooks: orders/create, orders/updated, orders/cancelled, refunds/create

Rate limits: 2 requests per second, tracked via bucket leak algorithm. Response header shows current usage.

Attribution data: Shopify orders include source_name, referring_site, landing_site with UTM parameters. System parses these to determine which channel brought the customer.

Meta Integration
OAuth scopes needed: ads_read, read_insights

Ad account selection: After OAuth, user may have multiple ad accounts. System fetches list, user selects which to track, selection stored.

APIs used:

Insights API for campaign performance data
Campaigns API for campaign metadata
Ad Sets API for ad set structure
Insights API specifics: Request data by date range and aggregation level (campaign, ad set, or ad level). Fields requested: spend, impressions, clicks, actions (conversions), action_values (conversion value). Time increment set to daily for per-day breakdown.

Pagination: Cursor-based. Response includes paging object with next URL and after cursor.

Rate limits: Complex. 200 calls per hour per token. Headers show remaining quota. System monitors and throttles.

Attribution windows: Meta reports conversions with different attribution windows (1-day click, 7-day click, 28-day view). System stores whatever Meta reports but documents which window used.

METRIC DEFINITIONS
Revenue
Sum of all paid order totals minus refunds. Cancelled and pending orders excluded. Only finalized revenue counted.

Ad Spend
Sum of all spend across Meta, Google, TikTok, and other connected ad platforms. Pulled from platform insights APIs.

ROAS (Return on Ad Spend)
Total revenue divided by total ad spend. Displayed as multiplier like 8.5x meaning every dollar spent returns eight dollars fifty in revenue.

Blended ROAS uses all revenue and all spend. Platform-specific ROAS uses only that platform's spend and attributed revenue.

CAC (Customer Acquisition Cost)
Total ad spend divided by number of new customers acquired. New customer = first order ever from that email address. Calculated by counting orders where is_first_order flag is true.

Not same as cost per order. CAC only counts first-time buyers.

AOV (Average Order Value)
Total revenue divided by number of orders. Shows typical order size.

CTR (Click-Through Rate)
Clicks divided by impressions, shown as percentage. Measures how compelling ads are.

CPC (Cost Per Click)
Ad spend divided by number of clicks. Shows cost to get someone to click ad.

CPM (Cost Per Mille)
Ad spend per 1000 impressions. Shows cost to show ad to 1000 people.

New vs Returning Customers
New customer = first order from email. Returning customer = subsequent orders from same email. Tracked via hashed email matching.

Gross Profit
Revenue minus cost of goods sold and ad spend. COGS estimated or imported from Shopify product costs if available.

Net Margin
Gross profit divided by revenue, shown as percentage.

Contribution Margin
Gross profit minus operating expenses. Shows true profitability.

DASHBOARD STRUCTURE
Overview Page
Top metrics cards showing revenue, orders, ad spend, ROAS with percentage changes compared to previous period.

Trend chart showing daily revenue and ad spend over last 60 days as line graph.

Channel comparison table showing each platform's spend, revenue, ROAS, orders, and efficiency metrics.

Recent alerts and notifications section.

Customers Page
Segment distribution pie chart showing what percentage of customers are VIP, loyal, at-risk, etc.

Customer list table with name, email, segment, order count, total spent, last order date. Searchable and filterable.

Segment summary cards showing average spend and order frequency per segment.

Cohorts Page
Retention matrix showing months across top and cohorts down left side. Cells show percentage of cohort that returned each month. Color-coded for easy pattern recognition.

Connections Page
List of connected platforms with status indicators. Connect buttons for platforms not yet connected. Sync buttons to manually trigger data refresh. Disconnect buttons to revoke access.

Billing Page
Current plan details, usage stats, upgrade options, payment method management, invoice history.

Settings Page
User profile, company details, timezone preference, currency preference, email notification settings.

JOB TYPES & QUEUE SYSTEM
Sync Job Types
Historical sync: User-initiated full sync of date range. Creates job with date range in parameters. Fetches all data in that range.

Incremental sync: Automated daily job that fetches last 24 hours of data. Keeps dashboard current without user action.

Webhook processing: Triggered when webhook received. Processes single webhook payload.

Aggregation: Computes daily metrics for date ranges. Triggered after sync completes or hourly by cron.

Job Lifecycle
Created with status pending. Worker picks up and changes status to running. On success, status becomes completed. On failure, status becomes retrying with next retry time set. After max retries, status becomes failed.

Job record includes progress tracking (records processed vs total), error messages, attempt count, cursor for resuming, timestamps for created/started/completed.

Queue Priorities
High priority queue for webhooks - processed within 1 minute.
Normal priority queue for incremental syncs - processed within 10 minutes.
Low priority queue for heavy aggregations - processed within 1 hour.
Dead letter queue for failed jobs after max retries - reviewed manually.

Worker Behavior
Cron triggers worker every 5 minutes. Worker checks for pending jobs, claims next job atomically (prevents multiple workers grabbing same job), executes job logic, updates status, repeats until no jobs left or timeout reached.

Workers deployed as serverless functions on Vercel. Auto-scale based on job volume.

ERROR HANDLING STRATEGY
API Errors
Platform API returns error response. Worker logs error details, increments retry counter, schedules retry with exponential backoff. After 5 retries, job marked failed and user notified.

Common errors: 429 rate limit (retry after delay), 401 unauthorized (token expired, try refresh), 500 server error (platform issue, retry), 404 not found (resource deleted, skip).

Token Expiration
Before each API call, check if token expires soon (within 24 hours). If yes, attempt refresh. Shopify tokens don't expire. Meta tokens expire after 60 days but can be exchanged for new long-lived tokens.

If refresh fails, mark connection status as error, alert user to reconnect.

Sync Failures
If historical sync fails mid-way, cursor position saved in job record. Next retry resumes from cursor instead of starting over. Prevents wasted API calls and respects rate limits.

Webhook Failures
If webhook processing fails, job goes to retry queue. Webhook payload preserved in database. After retries exhausted, webhook marked as failed but payload kept for manual investigation.

Database Errors
If database connection lost, API returns 503 Service Unavailable. Workers retry jobs. Critical operations wrapped in transactions to prevent partial updates.

Calculation Errors
Division by zero handled gracefully - returns zero instead of error. For example, ROAS when spend is zero returns zero, not crash. Non-numeric values logged as warnings but don't break dashboards.

TESTING STRATEGY
Data Accuracy Testing
Compare calculated metrics against platform dashboards. Revenue from Shopify admin should match revenue shown in our dashboard. Meta ad spend should match Meta Ads Manager.

Minor differences acceptable due to attribution windows and timezone handling, but should be within 2%.

Edge Case Testing
User with no orders - dashboard shows zero state gracefully.
User with no ad spend - ROAS and CAC show as not applicable.
User disconnects platform - data preserved, new data stops syncing.
Very large orders - no integer overflow or display issues.
Orders in foreign currencies - converted correctly.
Orders in different timezones - displayed in user's preferred timezone.

Failure Recovery Testing
Force API to fail mid-sync - job resumes from cursor.
Force database connection loss - operations retry successfully.
Force Redis unavailable - queue falls back gracefully.
Force rate limit hit - backoff and retry works.
Force token expiration - refresh attempt made.

Performance Testing
Load test with 100,000 orders - dashboard still fast.
Load test with 100 concurrent users - system responsive.
Test sync of 1 year of data - completes in reasonable time (under 10 minutes).
Test aggregation job with large dataset - completes within 1 hour.

Security Testing
Attempt webhook with invalid HMAC - rejected.
Attempt OAuth callback with invalid state - rejected.
Attempt to access another user's data - denied.
Attempt SQL injection in inputs - sanitized and blocked.
Attempt to read encrypted tokens - only encrypted values visible.

DEPLOYMENT & INFRASTRUCTURE
Hosting
Frontend and API on Vercel serverless platform. Auto-deploys from Git main branch. Preview deployments for pull requests.

Database
PostgreSQL hosted on Supabase with connection pooling enabled. Daily automated backups. Point-in-time recovery available.

Cache & Queue
Redis hosted on Upstash with HTTP-based access (works in serverless). Automatically scales.

Environment Variables
All secrets stored in Vercel environment variables, not in code. Separate environments for development, staging, production.

Monitoring
Error tracking via Sentry or similar. Uptime monitoring via Vercel analytics. Database query performance monitored via Supabase dashboard.

Cron Jobs
Sync worker runs every 5 minutes.
Aggregation worker runs every hour.
Token refresh checker runs daily.
Cleanup job for old Redis keys runs weekly.

NOTE: Vercel Hobby caps cron jobs at once per day — sub-daily expressions
fail the deployment. The ACTIVE every-2-days schedules are listed at the end
of this file. Reach the original 5-min/hourly cadence by upgrading to Vercel
Pro or adding Upstash QStash as the scheduler.

Scaling Strategy
Serverless functions auto-scale based on traffic. Database connection pooling prevents connection exhaustion. Redis caching reduces database load. Daily metrics table prevents expensive calculations on every request.

SUCCESS CRITERIA
Technical Success
Dashboard loads in under 2 seconds.
Historical sync of 1 year completes in under 10 minutes.
Webhooks processed in under 30 seconds.
Zero data loss - all API responses preserved.
Zero calculation errors - metrics match platforms within 2%.
99.9% uptime.

User Experience Success
User can connect Shopify in under 2 minutes.
User sees first data within 5 minutes of connecting.
Metrics easy to understand.
No confusing errors - clear messaging.
Sync failures recover automatically.

Business Success
Users trust the numbers.
Users find insights actionable.
Users prefer our dashboard over checking multiple platforms.
Users upgrade from trial to paid.

FINAL PRIORITIES
Accuracy over speed. If we have to choose between fast dashboard and correct numbers, choose correct numbers. Wrong calculations destroy trust.

Reliability over features. Better to have Shopify working perfectly than Shopify plus Meta both working poorly.

Security over convenience. Proper token encryption, webhook verification, OAuth security even if it takes longer to build.

User trust over everything. This is a premium product. Numbers must be right. Data must be safe. System must be reliable.

most of the part is already done check what can be use or what should replace to get best result. remember we are only working on backend part , no need to work for fronted , it will be managed by frontend developer.

today its 11-09-2026 and we are stating working on frontent part(we are frontend  team), our frontent part is already ready in webZERO folder. use frontend code/items only and dont use backend or engine code from webZERO. our backend/engine code is in data-pipeline folder so use backend work from data-pipeline and frontend things from webZERO folder which is inside of data-pipeline folder. test eveerything at the end and you can ask us if you see any conflict or want to make a decision during this pause the work and wait for our response to give you direction.

above work is done.
Cron Jobs (Vercel Hobby-safe — vercel.json)
* Vercel Hobby caps cron jobs at once per day; sub-daily expressions fail deployment.
* Config lives in vercel.json and runs in UTC:
  - Sync worker (drains webhook/sync/aggregation queues): every 2 days at 00:00.
  - Aggregation worker (recompute daily metrics + RFM): every 2 days at 01:00.
  - Incremental sync (24h fetch for active connections): every 2 days at 02:30.
  - Token refresh checker (flag expiring Meta tokens): every 2 days at 03:00.
  - Cleanup job for old Redis keys (cap job history + DLQ, recover stuck claims): weekly at 04:00.
* Trade-off: with the 2-day cadence, queued jobs can wait up to ~48h to drain.
  To restore the 5-min worker / hourly aggregation, upgrade to Vercel Pro or add
  Upstash QStash and point schedules at the same /api/cron/* endpoints.