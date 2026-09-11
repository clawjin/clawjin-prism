// src/lib/cleanup.ts
// Weekly Redis hygiene (AGENTS.md "Cleanup job for old Redis keys runs weekly").
//
// Bounds unbounded keys:
//   → recoverStuckJobs(): re-enqueue claims orphaned by crashed workers.
//   → jobs:user:<id>:    cap to the most recent 200 entries.
//   → queue:dead:        cap to the most recent 500 entries.
//
// Job data (job:<id>) and dedup/rate-limit keys already carry TTLs, so they
// are self-cleaning and intentionally not touched here.

import { redis } from "@/lib/redis";
import { recoverStuckJobs } from "@/lib/queue";

export interface CleanupSummary {
  recoveredClaims: number;
  userJobLists: number;
  userJobsTrimmed: number;
  deadQueueTrimmed: boolean;
  scans: number;
}

const MAX_USER_JOBS_PER_LIST = 200;
const MAX_DEAD_QUEUE_ENTRIES = 500;
const MAX_SCAN_ROUNDS = 20;

export async function cleanupRedisKeys(): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    recoveredClaims: 0,
    userJobLists: 0,
    userJobsTrimmed: 0,
    deadQueueTrimmed: false,
    scans: 0,
  };

  if (!redis.isConfigured()) return summary;

  // Re-queue jobs whose worker claim went stale (worker died mid-execution).
  summary.recoveredClaims = await recoverStuckJobs();

  // Cap per-user job-history lists so they can't grow unbounded.
  let cursor = "0";
  for (let round = 0; round < MAX_SCAN_ROUNDS; round++) {
    const [next, keys] = await redis.scan(cursor, "jobs:user:*", 100);
    cursor = next;
    summary.scans++;

    for (const key of keys) {
      await redis.ltrim(key, -MAX_USER_JOBS_PER_LIST, -1);
      summary.userJobLists++;
      summary.userJobsTrimmed++;
    }

    if (cursor === "0") break;
  }

  // Cap the dead-letter queue to recent entries (older ones stay reviewable
  // in DB-backed sync_jobs / webhook_events, which are the source of truth).
  await redis.ltrim("queue:dead", -MAX_DEAD_QUEUE_ENTRIES, -1);
  summary.deadQueueTrimmed = true;

  return summary;
}