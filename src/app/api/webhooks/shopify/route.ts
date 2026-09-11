// src/app/api/webhooks/shopify/route.ts
// Shopify webhook receiver — orders/create, orders/updated, orders/cancelled,
// refunds/create.
//
// Contract (AGENTS.md):
// → Verify HMAC BEFORE anything else; reject mismatches with 401
// → Store payload immediately, return 200 fast (<5s)
// → Process asynchronously via high-priority queue job
// → Deduplicate: Shopify retries aggressively

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  platformConnections,
  webhookEvents,
} from "@/db/schema";
import { verifyShopifyHmac } from "@/lib/webhook-verify";
import { enqueueJob } from "@/lib/queue";

const ACCEPTED_TOPICS = new Set([
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
]);

export async function POST(req: Request) {
  // 1. Raw body FIRST — signature is computed over exact bytes
  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = (req.headers.get("x-shopify-shop-domain") ?? "")
    .toLowerCase()
    .trim();
  const externalId =
    req.headers.get("x-shopify-webhook-id") ??
    // fallback to order id from payload
    (() => {
      try {
        return String(JSON.parse(rawBody).id ?? "");
      } catch {
        return "";
      }
    })();

  // 2. Verify HMAC — reject before ANY processing
  if (!verifyShopifyHmac(rawBody, signature)) {
    console.warn("[webhook:shopify] invalid HMAC — rejecting", {
      topic,
      shopDomain,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!ACCEPTED_TOPICS.has(topic)) {
    // Acknowledge uninteresting topics so Shopify stops retrying them
    return NextResponse.json({ ok: true, ignored: true });
  }

  // 3. Resolve tenant by shop domain (webhooks are app-level)
  let userId: number | null = null;
  let connectionId: number | null = null;

  const [conn] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.platform, "shopify"),
        eq(platformConnections.shopDomain, shopDomain),
        eq(platformConnections.status, "active")
      )
    )
    .limit(1);

  if (conn) {
    connectionId = conn.id;
    userId = conn.userId;
  } else {
    // Unknown shop: store for audit but cannot process
    userId = null;
  }

  // 4. Persist immediately (dedupe on webhook id via unique partial index;
  //    conflict → duplicate delivery, safe to ack)
  try {
    await db.insert(webhookEvents).values({
      userId,
      connectionId,
      platform: "shopify",
      topic,
      externalId: externalId || null,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
      hmacVerified: true,
      processed: false,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      /duplicate key|unique constraint/i.test(err.message)
    ) {
      // Duplicate webhook delivery — Shopify retries until we ack.
      return NextResponse.json({ ok: true, deduplicated: true });
    }
    throw err;
  }

  // 5. Enqueue async processing (high-priority queue) — only when resolvable
  if (userId && connectionId) {
    await enqueueJob({
      type: "webhook-process",
      userId,
      connectionId,
      payload: { topic, shopDomain, externalId },
      maxAttempts: 5,
    });
  }

  // 6. Fast 200 — processing happens in the worker
  return NextResponse.json({ ok: true });
}
