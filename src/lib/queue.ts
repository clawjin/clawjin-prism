// src/lib/queue.ts
// Redis job queue over Upstash REST — serverless safe.
//
// Guarantees:
// → ATOMIC claiming: Lua compare-and-swap means two concurrent worker
//   invocations can never grab the same job.
// → PRIORITIES: webhook > sync > aggregation (claimed in that order).
// → RETRIES: exponential backoff + random jitter, max 5 attempts.
// → DEAD LETTER: exhausted jobs land in queue:dead for manual review.
//
// Job data lives in `job:{id}` keys (24h TTL). Queues hold job IDs only.

import crypto from "node:crypto";
import { redis } from "@/lib/redis";

// ── Job Types ────────────────────────────────────────────────────────────────

export type JobType =
  | "shopify-historical-sync"
  | "shopify-incremental-sync"
  | "meta-historical-sync"
  | "meta-incremental-sync"
  | "webhook-process"
  | "aggregation";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export interface Job {
  id: string;
  type: JobType;
  userId: number;
  connectionId: number;
  status: JobStatus;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  /** Epoch ms — claim loop skips jobs scheduled in the future. */
  scheduledForMs: number;
  lastError?: string;
}

// ── Queue Keys ───────────────────────────────────────────────────────────────

export const QUEUE_KEYS = {
  webhook: "queue:webhook",
  sync: "queue:sync",
  aggregation: "queue:aggregation",
  dead: "queue:dead", // dead letter queue
  processing: "queue:processing",
  jobData: (id: string) => `job:${id}`,
  userJobs: (userId: number) => `jobs:user:${userId}`,
} as const;

const JOB_TTL_SECONDS = 60 * 60 * 24; // 24h

function queueFor(type: JobType): string {
  if (type.includes("webhook")) return QUEUE_KEYS.webhook;
  if (type === "aggregation") return QUEUE_KEYS.aggregation;
  return QUEUE_KEYS.sync;
}

// ── Atomic Claim (Lua) ───────────────────────────────────────────────────────

/**
 * Scan up to LLEN entries rotating each popped id to the tail until an
 * eligible job is found. Eligible = data exists AND scheduledForMs <= now.
 * Rotation preserves future-scheduled jobs; the loop terminates after one
 * full revolution. HSETNX marks the claim so a second worker's HSETNX fails
 * and it keeps scanning.
 */
const CLAIM_SCRIPT = `
local queue   = KEYS[1]
local procKey = KEYS[2]
local now     = tonumber(ARGV[1])
local worker  = ARGV[2]

local len = redis.call('LLEN', queue)
if len == 0 then return nil end

for i = 1, len do
  local id = redis.call('LPOP', queue)
  if not id then break end

  local raw = redis.call('GET', 'job:' .. id)
  if raw then
    local ok, job = pcall(cjson.decode, raw)
      if ok and type(job) == 'table' then
        local sched = tonumber(job.scheduledForMs or 0) or 0
        if sched <= now then
          local claimed = redis.call('HSETNX', procKey, id, worker)
          if claimed == 1 then
            return {id, raw} -- stays out of queue until complete/retry/recovery
          end
        end
      end
  end
  redis.call('RPUSH', queue, id) -- not eligible: rotate to tail
end
return nil
`;

export interface ClaimedJob {
  id: string;
  job: Job;
}

/** Atomically claim one eligible job from a priority-ordered queue list. */
export async function claimJob(
  queues: string[],
  workerId: string
): Promise<ClaimedJob | null> {
  for (const queue of queues) {
    try {
      const result = await redis.eval(
        CLAIM_SCRIPT,
        [queue, QUEUE_KEYS.processing],
        [String(Date.now()), workerId]
      ) as [string, string] | null;

      if (result && result[0]) {
        try {
          const job = JSON.parse(result[1]) as Job;
          job.status = "running";
          await updateJob(job.id, { status: "running" });
          // Stamp claim with worker id + time for crash recovery
          await redis.hset(
            QUEUE_KEYS.processing,
            result[0],
            `${Date.now()}:${workerId}`
          );
          return { id: result[0], job };
        } catch {
          await releaseClaim(result[0]);
        }
      }
    } catch (err) {
      console.error(`[queue] claim failed on ${queue}:`, err);
    }
  }
  return null;
}

/** Release a claim without completing (crash recovery / internal error). */
export async function releaseClaim(jobId: string): Promise<void> {
  try {
    await redisRequestDel(QUEUE_KEYS.processing, jobId);
  } catch { /* best effort */ }
}

async function redisRequestDel(hashKey: string, field: string): Promise<void> {
  // HDEL wrapper — kept tiny to avoid importing more primitives
  await redis.hdel(hashKey, field);
}

// ── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueJob(params: {
  type: JobType;
  userId: number;
  connectionId: number;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  delaySeconds?: number;
}): Promise<string> {
  const jobId = `${params.type}-${params.userId}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")}`;

  const job: Job = {
    id: jobId,
    type: params.type,
    userId: params.userId,
    connectionId: params.connectionId,
    status: "pending",
    payload: params.payload,
    attemptCount: 0,
    maxAttempts: params.maxAttempts ?? 5,
    createdAt: new Date().toISOString(),
    scheduledForMs: Date.now() + (params.delaySeconds ?? 0) * 1000,
  };

  await redis.set(QUEUE_KEYS.jobData(jobId), JSON.stringify(job), JOB_TTL_SECONDS);
  await redis.rpush(queueFor(params.type), jobId);
  await redis.rpush(QUEUE_KEYS.userJobs(params.userId), jobId);

  console.log(`[queue] enqueued ${jobId}`);
  return jobId;
}

// ── Completion / Failure ─────────────────────────────────────────────────────

export async function completeJob(jobId: string): Promise<void> {
  await updateJob(jobId, { status: "completed" });
  await redis.hdel(QUEUE_KEYS.processing, jobId);
}

/**
 * Handle a failed attempt.
 * Retries left  → status retrying, exponential backoff + jitter, re-enqueued.
 * Exhausted     → moved to DLQ, status failed, alert payload preserved.
 */
export async function failJob(
  job: Job,
  error: unknown
): Promise<"retrying" | "dead"> {
  const message =
    error instanceof Error ? error.message : String(error).slice(0, 500);
  const attemptCount = job.attemptCount + 1;

  if (attemptCount >= job.maxAttempts) {
    await updateJob(job.id, {
      status: "failed",
      attemptCount,
      lastError: message.slice(0, 500),
    });
    await redis.rpush(QUEUE_KEYS.dead, job.id);
    await redis.hdel(QUEUE_KEYS.processing, job.id);
    console.error(`[queue] job ${job.id} → DEAD LETTER: ${message}`);
    return "dead";
  }

  // Exponential backoff with jitter: 1s, 2s, 4s, 8s... ± up to 500ms
  const backoffMs = Math.pow(2, attemptCount - 1) * 1000;
  const jitter = Math.random() * 500;
  const nextAt = Date.now() + backoffMs + jitter;

  await updateJob(job.id, {
    status: "retrying",
    attemptCount,
    lastError: message.slice(0, 500),
    scheduledForMs: nextAt,
  });
  // Re-enqueue at tail — claim loop ignores it until nextAt passes
  await redis.rpush(queueFor(job.type), job.id);
  await redis.hdel(QUEUE_KEYS.processing, job.id);

  console.log(
    `[queue] job ${job.id} retry #${attemptCount} in ${Math.round(backoffMs + jitter)}ms`
  );
  return "retrying";
}

/**
 * Crash recovery: re-enqueue jobs whose claim is stale (worker died
 * mid-execution). Claims older than CLAIM_TIMEOUT_MS are considered orphaned.
 */
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

export async function recoverStuckJobs(): Promise<number> {
  try {
    const claims = await redis.hgetall(QUEUE_KEYS.processing);
    if (!claims) return 0;

    let recovered = 0;
    for (const [jobId, workerStamp] of Object.entries(claims)) {
      const stampMs = Number(workerStamp.split(":")[0] ?? 0);
      if (!stampMs || Date.now() - stampMs < CLAIM_TIMEOUT_MS) continue;

      const job = await getJob(jobId);
      if (!job) {
        await redis.hdel(QUEUE_KEYS.processing, jobId);
        continue;
      }
      // Re-queue immediately and drop the stale claim
      await redis.rpush(queueFor(job.type), jobId);
      await redis.hdel(QUEUE_KEYS.processing, jobId);
      console.warn(`[queue] recovered stuck job ${jobId}`);
      recovered++;
    }
    return recovered;
  } catch (err) {
    console.error("[queue] recoverStuckJobs failed:", err);
    return 0;
  }
}

// ── Introspection ────────────────────────────────────────────────────────────

export async function getJob(jobId: string): Promise<Job | null> {
  const data = await redis.get(QUEUE_KEYS.jobData(jobId));
  if (!data) return null;
  return JSON.parse(data) as Job;
}

export async function updateJob(
  jobId: string,
  updates: Partial<Job>
): Promise<Job | null> {
  const job = await getJob(jobId);
  if (!job) return null;

  const updated = { ...job, ...updates };
  await redis.set(
    QUEUE_KEYS.jobData(jobId),
    JSON.stringify(updated),
    JOB_TTL_SECONDS
  );
  return updated;
}

/** Read-only view of a user's recent jobs (no destructive pops). */
export async function getUserJobs(userId: number, limit = 20): Promise<Job[]> {
  try {
    const key = QUEUE_KEYS.userJobs(userId);
    const length = await redis.llen(key);
    if (length === 0) return [];

    const start = Math.max(-length, -limit);
    const ids = await redis.lrange(key, start, -1);

    const jobs: Job[] = [];
    for (const id of ids.reverse()) {
      const job = await getJob(id);
      if (job) jobs.push(job);
    }
    return jobs;
  } catch {
    return [];
  }
}

export async function getQueueDepths(): Promise<{
  webhook: number;
  sync: number;
  aggregation: number;
  dead: number;
}> {
  const [webhook, sync, aggregation, dead] = await Promise.all([
    redis.llen(QUEUE_KEYS.webhook),
    redis.llen(QUEUE_KEYS.sync),
    redis.llen(QUEUE_KEYS.aggregation),
    redis.llen(QUEUE_KEYS.dead),
  ]);
  return { webhook, sync, aggregation, dead };
}
