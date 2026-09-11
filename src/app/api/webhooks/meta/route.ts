// src/app/api/webhooks/meta/route.ts
// Meta webhook receiver (real-time ad insights / lead events).
//
// GET  → hub.challenge handshake (Meta subscription verification)
// POST → verify X-Hub-Signature-256, persist, enqueue async processing

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformConnections, webhookEvents } from "@/db/schema";
import { verifyMetaHmac } from "@/lib/webhook-verify";
import { enqueueJob } from "@/lib/queue";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    challenge &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaHmac(rawBody, signature)) {
    console.warn("[webhook:meta] invalid signature — rejecting");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Meta sends batched entries — one webhook_events row per entry
  for (const entry of payload.entry ?? []) {
    const accountId = entry.id ?? null;

    let userId: number | null = null;
    let connectionId: number | null = null;

    if (accountId) {
      const [conn] = await db
        .select()
        .from(platformConnections)
        .where(
          eq(platformConnections.externalAccountId, `act_${accountId.replace(/^act_/, "")}`)
        )
        .limit(1)
        .catch(() => []);
      if (conn) {
        connectionId = conn.id;
        userId = conn.userId;
      }
    }

    try {
      await db.insert(webhookEvents).values({
        userId,
        connectionId,
        platform: "meta",
        topic: payload.object ?? "ads",
        externalId: `${accountId}:${Date.now()}`,
        payload: entry as unknown as Record<string, unknown>,
        hmacVerified: true,
        processed: false,
      });
    } catch {
      continue; // dedupe or transient insert issue — ack the rest
    }

    if (userId && connectionId) {
      await enqueueJob({
        type: "webhook-process",
        userId,
        connectionId,
        payload: { source: "meta", accountId },
        maxAttempts: 5,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
