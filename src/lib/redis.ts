// src/lib/redis.ts
// Clawjin Prism — Redis Client
// Uses Upstash Redis (HTTP-based, works in serverless + edge)
// Used for: rate limiting, job queues, caching, deduplication

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.warn(
    "[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. " +
    "Redis features (queues, caching) will be disabled."
  );
}

// ── Core Redis Request ────────────────────────────────────────────────────────

async function redisRequest(command: unknown[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("[redis] Redis is not configured. Check .env.local");
  }

  const res = await fetch(REDIS_URL, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[redis] Request failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { result: unknown; error?: string };

  if (data.error) {
    throw new Error(`[redis] Error: ${data.error}`);
  }

  return data.result;
}

// ── Redis Commands ────────────────────────────────────────────────────────────

export const redis = {
  // ── String Operations ──────────────────────────────────────────────────────

  /**
   * Set a key with optional TTL in seconds
   * set("key", "value", 3600) → expires in 1 hour
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await redisRequest(["SET", key, value, "EX", ttlSeconds]);
    } else {
      await redisRequest(["SET", key, value]);
    }
  },

  /**
   * Get a value by key
   * Returns null if key does not exist or expired
   */
  async get(key: string): Promise<string | null> {
    const result = await redisRequest(["GET", key]);
    return result as string | null;
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    await redisRequest(["DEL", key]);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redisRequest(["EXISTS", key]);
    return result === 1;
  },

  /**
   * Set expiry on existing key (seconds)
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await redisRequest(["EXPIRE", key, ttlSeconds]);
  },

  // ── Counter Operations ─────────────────────────────────────────────────────

  /**
   * Increment a counter, returns new value
   * Used for rate limiting
   */
  async incr(key: string): Promise<number> {
    const result = await redisRequest(["INCR", key]);
    return result as number;
  },

  /**
   * Increment by amount
   */
  async incrby(key: string, amount: number): Promise<number> {
    const result = await redisRequest(["INCRBY", key, amount]);
    return result as number;
  },

  // ── Hash Operations ────────────────────────────────────────────────────────

  /**
   * Set a field in a hash
   * Used for storing job state
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    await redisRequest(["HSET", key, field, value]);
  },

  /**
   * Get a field from a hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    const result = await redisRequest(["HGET", key, field]);
    return result as string | null;
  },

  /**
   * Get all fields from a hash
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = await redisRequest(["HGETALL", key]);
    if (!result || !Array.isArray(result) || result.length === 0) return null;
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i] as string] = result[i + 1] as string;
    }
    return obj;
  },

  /**
   * Delete field(s) from a hash
   */
  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    await redisRequest(["HDEL", key, ...fields]);
  },

  // ── List Operations ────────────────────────────────────────────────────────

  /**
   * Push to end of list (queue)
   */
  async rpush(key: string, value: string): Promise<number> {
    const result = await redisRequest(["RPUSH", key, value]);
    return result as number;
  },

  /**
   * Pop from front of list (dequeue)
   */
  async lpop(key: string): Promise<string | null> {
    const result = await redisRequest(["LPOP", key]);
    return result as string | null;
  },

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    const result = await redisRequest(["LLEN", key]);
    return result as number;
  },

  /**
   * Read a range of list items WITHOUT consuming them.
   * Negative indices count from the end (-20..-1 = last 20).
   */
  async lrange(
    key: string,
    start: number,
    stop: number
  ): Promise<string[]> {
    const result = await redisRequest(["LRANGE", key, start, stop]);
    return Array.isArray(result) ? (result as string[]) : [];
  },

  /**
   * Remove matching occurrences of value from list (0 = all).
   */
  async lrem(key: string, value: string): Promise<void> {
    await redisRequest(["LREM", key, "0", value]);
  },

  /**
   * Trim a list to the specified range (negative indices count from end).
   * Used by the weekly cleanup to cap per-user job history and the DLQ.
   */
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await redisRequest(["LTRIM", key, String(start), String(stop)]);
  },

  /**
   * Execute a Lua script atomically server-side.
   * Used for the worker's compare-and-swap job claiming — no race between
   * concurrent serverless invocations.
   */
  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    return redisRequest([
      "EVAL",
      script,
      String(keys.length),
      ...keys,
      ...args,
    ]);
  },

  // ── Set Operations ─────────────────────────────────────────────────────────

  /**
   * Add member to set
   * Used for deduplication (webhook IDs etc.)
   */
  async sadd(key: string, member: string): Promise<number> {
    const result = await redisRequest(["SADD", key, member]);
    return result as number;
  },

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await redisRequest(["SISMEMBER", key, member]);
    return result === 1;
  },

  // ── Utility ────────────────────────────────────────────────────────────────

  /**
   * Ping Redis to check connection
   */
  async ping(): Promise<boolean> {
    try {
      const result = await redisRequest(["PING"]);
      return result === "PONG";
    } catch {
      return false;
    }
  },

  /**
   * Check if Redis is configured
   */
  isConfigured(): boolean {
    return !!(REDIS_URL && REDIS_TOKEN);
  },

  /**
   * Incrementally iterate over keys matching a glob pattern (SCAN).
   * Returns [nextCursor, keys]; nextCursor is "0" when the scan completes.
   * Used by the weekly cleanup to find per-user job-history lists.
   */
  async scan(
    cursor: string,
    match: string,
    count = 100
  ): Promise<[string, string[]]> {
    const result = await redisRequest([
      "SCAN",
      cursor,
      "MATCH",
      match,
      "COUNT",
      String(count),
    ]);
    const arr = result as [string, string[]];
    return [
      String(arr[0] ?? "0"),
      Array.isArray(arr[1]) ? arr[1] : [],
    ];
  },
};

// ── Rate Limiter ──────────────────────────────────────────────────────────────

/**
 * Redis-based sliding window rate limiter
 * More accurate than in-memory version
 * Works across multiple server instances
 *
 * Returns: { allowed: boolean, remaining: number, resetIn: number }
 */
export async function redisRateLimit(
  key:       string,
  limit:     number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  try {
    const redisKey = `rl:${key}`;
    const count    = await redis.incr(redisKey);

    // Set expiry only on first request in window
    if (count === 1) {
      await redis.expire(redisKey, windowSec);
    }

    const allowed   = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetIn: windowSec };

  } catch (err) {
    // If Redis fails → fall back to allowing request
    // Never block users because Redis is down
    console.error("[redis] Rate limit check failed, allowing request:", err);
    return { allowed: true, remaining: limit, resetIn: windowSec };
  }
}

// ── Cache Helper ──────────────────────────────────────────────────────────────

/**
 * Get from cache or compute and store
 * 
 * Usage:
 * const data = await cached("overview:123", 300, () => getOverview(123));
 * 
 * → Checks Redis for "overview:123"
 * → If found → return cached value (instant)
 * → If not found → call getOverview(123), store result, return it
 */
export async function cached<T>(
  key:       string,
  ttlSeconds: number,
  compute:   () => Promise<T>
): Promise<T> {
  try {
    if (redis.isConfigured()) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    }
  } catch (err) {
    console.error("[redis] Cache read failed:", err);
  }

  // Compute fresh value
  const value = await compute();

  // Store in cache
  try {
    if (redis.isConfigured()) {
      await redis.set(key, JSON.stringify(value), ttlSeconds);
    }
  } catch (err) {
    console.error("[redis] Cache write failed:", err);
  }

  return value;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Check if we have seen this ID before (webhook deduplication)
 * Returns true if this is a NEW id (not seen before)
 * Returns false if this is a DUPLICATE (seen before)
 *
 * Usage:
 * const isNew = await dedup("shopify:webhook", "order_123", 86400);
 * if (!isNew) return; // skip duplicate
 */
export async function dedup(
  namespace: string,
  id:        string,
  ttlSeconds: number = 86400 // 24 hours default
): Promise<boolean> {
  try {
    if (!redis.isConfigured()) return true; // if no Redis, assume new

    const key    = `dedup:${namespace}:${id}`;
    const exists = await redis.exists(key);

    if (exists) return false; // duplicate

    await redis.set(key, "1", ttlSeconds);
    return true; // new

  } catch (err) {
    console.error("[redis] Dedup check failed:", err);
    return true; // if Redis fails, assume new (better than blocking)
  }
}