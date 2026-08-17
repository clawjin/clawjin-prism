// ---------------------------------------------------------------------------
// Lightweight in-memory rate limiter (sliding window).
// Guards the auth endpoints against brute-force / abuse. Note: in a serverless
// multi-instance deployment this is per-instance — for a hard global limit,
// swap in Upstash Redis or similar. It still stops casual brute-forcing.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  // Opportunistic cleanup to avoid unbounded growth.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
