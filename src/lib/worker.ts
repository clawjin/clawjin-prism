// src/lib/worker.ts
// Serverless worker loop — one invocation claims + processes jobs until its
// time budget expires (Vercel functions cap at 10s-300s depending on plan).
//
// Claim priority: webhooks → syncs → aggregation (AGENTS.md queue policy).
// Long syncs self-chain: each invocation processes pages until the budget is
// exhausted, then re-enqueues itself to continue on the next trigger.

import {
  QUEUE_KEYS,
  claimJob,
  completeJob,
  failJob,
  enqueueJob,
  type Job,
  type JobType,
} from "@/lib/queue";
import { runSyncPage, type SyncJobPayload } from "@/lib/sync-engine";
import { aggregateUserDay } from "@/lib/aggregation";
import { db } from "@/db";
import { normalizedOrders, webhookEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizeShopifyOrder } from "@/modules/shopify/normalize";
import { upsertOrdersFromWebhook } from "@/lib/webhook-processing";

const WORKER_ID = `w-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_BUDGET_MS = 25_000; // leave headroom under serverless caps

type Handler = (
  job: Job,
  budget: { remainingMs(): number }
) => Promise<void>;

// ── Handlers ─────────────────────────────────────────────────────────────────

const SYNC_TYPES: Set<JobType> = new Set([
  "shopify-historical-sync",
  "shopify-incremental-sync",
  "meta-historical-sync",
  "meta-incremental-sync",
]);

/** Sync jobs page through data; re-enqueue self when budget runs out mid-job. */
async function handleSync(
  job: Job,
  budget: { remainingMs(): number }
): Promise<void> {
  let result = await runSyncPage(job);

  while (!result.finished && budget.remainingMs() > 5_000) {
    const continuation: Job = {
      ...job,
      payload: { ...job.payload, cursor: result.cursor },
    };
    result = await runSyncPage(continuation);
  }

  if (!result.finished) {
    // Budget exhausted — chain another job to resume from this cursor
    await enqueueJob({
      type: job.type,
      userId: job.userId,
      connectionId: job.connectionId,
      payload: {
        ...(job.payload as SyncJobPayload),
        cursor: result.cursor,
        syncJobDbId: (job.payload as SyncJobPayload).syncJobDbId,
      },
      maxAttempts: job.maxAttempts,
    });
  }
}

/**
 * Webhook jobs: normalize the stored payload into orders, rollup customers,
 * refresh metrics for the affected day. Payload was persisted by the
 * receiver — this handler only reads DB state.
 */
async function handleWebhookProcess(job: Job): Promise<void> {
  const topic = String(job.payload.topic ?? "");
  const externalId = String(job.payload.externalId ?? "");
  if (!externalId) return;

  // Refunds/cancellations arrive as their own events — find the matching
  // webhook row(s) and re-normalize the referenced order.
  const rows = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.platform, "shopify"),
        eq(webhookEvents.externalId, externalId),
        eq(webhookEvents.processed, false)
      )
    )
    .limit(10);

  for (const row of rows) {
    try {
      if (topic.startsWith("refunds/")) {
        // Payload references order_id — pull nothing extra: refunds/create
        // carries the refund but our upsert path needs the full order.
        // Mark processed; nightly incremental sync reconciles net revenue.
        await markProcessed(row.id);
        continue;
      }

      const orderRow = row.payload as unknown as Record<string, unknown>;
      const normalized = normalizeShopifyOrder(orderRow, {
        userId: row.userId ?? job.userId,
        connectionId: row.connectionId ?? job.connectionId,
      });

      if (normalized) {
        await upsertOrdersFromWebhook([normalized]);
        await aggregateUserDay(
          row.userId ?? job.userId,
          normalized.orderedAt.toISOString().slice(0, 10)
        );
      }
      await markProcessed(row.id);
    } catch (err) {
      await db
        .update(webhookEvents)
        .set({ errorMessage: err instanceof Error ? err.message.slice(0, 500) : "unknown" })
        .where(eq(webhookEvents.id, row.id));
      throw err; // surface to retry machinery
    }
  }
}

async function markProcessed(webhookRowId: number): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processed: true, processedAt: new Date(), errorMessage: null })
    .where(eq(webhookEvents.id, webhookRowId));
}

/** Aggregation jobs recompute daily metric rows. */
async function handleAggregation(job: Job): Promise<void> {
  const { aggregateUserDay, refreshSegments } = await import("@/lib/aggregation");
  const userId = Number(job.payload.userId ?? job.userId);
  const dateFrom = job.payload.dateFrom as string | undefined;
  const dateTo = job.payload.dateTo as string | undefined;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const days = new Set<string>([today, yesterday]);
  if (dateFrom && dateTo) {
    let t = Date.parse(`${dateFrom}T00:00:00Z`);
    const end = Date.parse(`${dateTo}T00:00:00Z`);
    for (; t <= end; t += 86_400_000) {
      days.add(new Date(t).toISOString().slice(0, 10));
    }
  }

  for (const day of days) {
    await aggregateUserDay(userId, day);
  }
  await refreshSegments(userId);
}

const HANDLERS: Record<JobType, Handler> = {
  "shopify-historical-sync": handleSync,
  "shopify-incremental-sync": handleSync,
  "meta-historical-sync": handleSync,
  "meta-incremental-sync": handleSync,
  "webhook-process": handleWebhookProcess,
  aggregation: handleAggregation,
};

// ── Main loop ────────────────────────────────────────────────────────────────

export interface WorkerRunSummary {
  claimed: number;
  completed: number;
  failed: number;
  budgetExhausted: boolean;
}

/**
 * Process queued jobs until budget expiry.
 * Returns a summary for logging/monitoring.
 */
export async function processJobs(
  budgetMs: number = DEFAULT_BUDGET_MS
): Promise<WorkerRunSummary> {
  const startedAt = Date.now();
  const summary: WorkerRunSummary = {
    claimed: 0,
    completed: 0,
    failed: 0,
    budgetExhausted: false,
  };

  while (Date.now() - startedAt < budgetMs) {
    const claimed = await claimJob(
      [QUEUE_KEYS.webhook, QUEUE_KEYS.sync, QUEUE_KEYS.aggregation],
      WORKER_ID
    );
    if (!claimed) break; // queues empty

    summary.claimed++;
    const handler = HANDLERS[claimed.job.type];

    const budgetRemaining =
      budgetMs - (Date.now() - startedAt);

    try {
      await handler(claimed.job, {
        remainingMs: () => budgetMs - (Date.now() - startedAt),
      });
      void budgetRemaining;
      await completeJob(claimed.id);
      summary.completed++;
    } catch (err) {
      console.error(`[worker] job ${claimed.id} failed:`, err);
      await failJob(claimed.job, err);
      summary.failed++;
    }
  }

  if (Date.now() - startedAt >= budgetMs) summary.budgetExhausted = true;
  return summary;
}

// Re-export for route usage
export { recoverStuckJobs } from "@/lib/queue";

// Keep import used (webhook path imports shared upsert helper)
void normalizedOrders;
