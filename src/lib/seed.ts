// src/lib/seed.ts
// Clawjin Prism — Demo Workspace Seeder
// ONLY used for /demo page — never for real user accounts

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  normalizedAdSpend,
  alerts,
  platformConnections,
  normalizedCustomers,
  normalizedOrders,
} from "@/db/schema";
import { computeSegment } from "@/lib/segments";
import { toCents } from "@/lib/money";
import { hashEmail } from "@/lib/hash";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ava","Liam","Maya","Noah","Zoe","Ethan","Isla","Lucas","Nora",
  "Mason","Chloe","Logan","Ruby","Elijah","Sofia","Carter","Ivy",
  "Owen","Lily","Jackson","Hazel","Aiden","Ella","Grayson",
];

const LAST_NAMES = [
  "Chen","Patel","Kim","Garcia","Nguyen","Smith","Brown","Lopez",
  "Davis","Wilson","Moore","Taylor","Martinez","Anderson","Thomas",
];

const DOMAINS = ["gmail.com","yahoo.com","outlook.com","icloud.com"];

const CHANNELS = [
  { name: "meta",   base: 450, growth: 0.55, cpm: 11,  ctr: 0.012, cvr: 0.027, weight: 0.44 },
  { name: "google", base: 255, growth: 0.42, cpm: 8.5, ctr: 0.022, cvr: 0.034, weight: 0.30 },
  { name: "tiktok", base: 116, growth: 0.85, cpm: 6.2, ctr: 0.018, cvr: 0.019, weight: 0.26 },
] as const;

type Channel = "meta" | "google" | "tiktok";

const DAYS   = 150;
const DAY_MS = 86_400_000;

function pickChannel(rng: () => number): Channel {
  const r = rng();
  let acc = 0;
  for (const c of CHANNELS) {
    acc += c.weight;
    if (r <= acc) return c.name;
  }
  return "meta";
}

export async function seedWorkspace(userId: number) {
  const rng     = mulberry32(0x9e3779b9 ^ userId);
  const now     = new Date();
  const startMs = now.getTime() - DAYS * DAY_MS;

  // ── Platform connections ──────────────────────────────────────────────────
  await db.insert(platformConnections).values([
    {
      userId,
      platform:          "shopify",
      displayName:       "Demo Shopify Store",
      status:            "active",
      externalAccountId: "demo-shop.myshopify.com",
      shopDomain:        "demo-shop.myshopify.com",
      lastSyncAt:        new Date(now.getTime() - 8 * 60_000),
    },
    {
      userId,
      platform:          "meta",
      displayName:       "Demo Meta Ads",
      status:            "active",
      externalAccountId: "act_demo123456",
      lastSyncAt:        new Date(now.getTime() - 12 * 60_000),
    },
    {
      userId,
      platform:          "google",
      displayName:       "Demo Google Ads",
      status:            "active",
      externalAccountId: "google-demo-account",
      lastSyncAt:        new Date(now.getTime() - 14 * 60_000),
    },
  ]).onConflictDoNothing();

  // Get shopify connection id
  const [shopifyConn] = await db
    .select()
    .from(platformConnections)
    .where(and(
      eq(platformConnections.userId, userId),
      eq(platformConnections.platform, "shopify")
    ))
    .limit(1);

  const connId = shopifyConn?.id ?? 1;

  // ── Customers + Orders ────────────────────────────────────────────────────
  const customerCount = 300;

  type OrderRow = {
    externalOrderId:   string;
    orderNumber:       string;
    subtotalCents:     number;
    shippingCents:     number;
    taxCents:          number;
    totalCents:        number;
    netRevenueCents:   number;
    refundedCents:     number;
    attributionSource: Channel | "direct";
    orderedAt:         Date;
    status:            "paid" | "refunded";
    isFirstOrder:      boolean;
  };

  type LocalCustomer = {
    email:             string;
    name:              string;
    emailHash:         string;
    firstOrderAt:      Date;
    lastOrderAt:       Date;
    orderCount:        number;
    totalSpentCents:   number;
    segment:           string;
    acquisitionSource: Channel;
    orders:            OrderRow[];
  };

  const localCustomers: LocalCustomer[] = [];

  for (let i = 0; i < customerCount; i++) {
    const first  = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!;
    const last   = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!;
    const name   = `${first} ${last}`;
    const email  = `${first.toLowerCase()}.${last.toLowerCase()}${
      Math.floor(rng() * 90) + 10
    }@${DOMAINS[Math.floor(rng() * DOMAINS.length)]}`;

    const r = rng();
    const orderCount =
      r < 0.28 ? 1
      : r < 0.5  ? 2
      : r < 0.72 ? 3
      : r < 0.88 ? 4
      : 5 + Math.floor(rng() * 3);

    const aovDollars = 60 + rng() * 80;
    const firstDay   = Math.floor(rng() * 130);
    const channel    = pickChannel(rng);
    const orderList: OrderRow[] = [];
    let day = firstDay;

    for (let k = 0; k < orderCount; k++) {
      if (k > 0) day = day + 6 + Math.floor(rng() * 28);
      if (day > DAYS - 1) break;

      const revenueDollars  = Math.max(20, aovDollars + (rng() - 0.5) * 40);
      const shippingDollars = 5 + rng() * 10;
      const subtotalCents   = toCents(revenueDollars);
      const shippingCents   = toCents(shippingDollars);
      const taxCents        = Math.round(subtotalCents * 0.08);
      const totalCents      = subtotalCents + shippingCents + taxCents;
      const isRefunded      = rng() < 0.035;

      orderList.push({
        externalOrderId:   `demo-${userId}-${i}-${k}`,
        orderNumber:       `#${1000 + i * 10 + k}`,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        netRevenueCents:   isRefunded ? 0 : totalCents,
        refundedCents:     isRefunded ? totalCents : 0,
        attributionSource: k === 0 ? channel : "direct",
        orderedAt:         new Date(startMs + day * DAY_MS),
        status:            isRefunded ? "refunded" : "paid",
        isFirstOrder:      k === 0,
      });
    }

    if (orderList.length === 0) continue;

    const paidOrders      = orderList.filter((o) => o.status === "paid");
    const totalSpentCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);
    const lastOrderAt     = orderList[orderList.length - 1]!.orderedAt;
    const recencyDays     = Math.round(
      (now.getTime() - lastOrderAt.getTime()) / DAY_MS
    );

    localCustomers.push({
      email,
      name,
      emailHash:         hashEmail(email)!,
      firstOrderAt:      orderList[0]!.orderedAt,
      lastOrderAt,
      orderCount:        paidOrders.length,
      totalSpentCents,
      segment:           computeSegment({
        orderCount:  paidOrders.length,
        totalSpend:  totalSpentCents / 100,
        recencyDays,
      }),
      acquisitionSource: channel,
      orders:            orderList,
    });
  }

  // Insert customers
  const BATCH = 50;
  for (let i = 0; i < localCustomers.length; i += BATCH) {
    await db.insert(normalizedCustomers).values(
      localCustomers.slice(i, i + BATCH).map((c) => ({
        userId,
        emailHash:         c.emailHash,
        email:             c.email,
        name:              c.name,
        firstOrderAt:      c.firstOrderAt,
        lastOrderAt:       c.lastOrderAt,
        orderCount:        c.orderCount,
        totalSpentCents:   c.totalSpentCents,
        acquisitionSource: c.acquisitionSource,
        segment:           c.segment,
      }))
    ).onConflictDoNothing();
  }

  // Insert orders
  const allOrders = localCustomers.flatMap((c) =>
    c.orders.map((o) => ({
      userId,
      connectionId:      connId,
      platform:          "shopify" as const,
      externalOrderId:   o.externalOrderId,
      orderNumber:       o.orderNumber,
      status:            o.status,
      currency:          "USD",
      subtotalCents:     o.subtotalCents,
      discountCents:     0,
      shippingCents:     o.shippingCents,
      taxCents:          o.taxCents,
      totalCents:        o.totalCents,
      refundedCents:     o.refundedCents,
      netRevenueCents:   o.netRevenueCents,
      attributionSource: o.attributionSource,
      isFirstOrder:      o.isFirstOrder,
      lineItemsCount:    1,
      orderedAt:         o.orderedAt,
    }))
  );

  for (let i = 0; i < allOrders.length; i += 100) {
    await db.insert(normalizedOrders)
      .values(allOrders.slice(i, i + 100))
      .onConflictDoNothing();
  }

  // ── Ad spend ──────────────────────────────────────────────────────────────
  const spendRows: typeof normalizedAdSpend.$inferInsert[] = [];

  for (let d = 0; d < DAYS; d++) {
    const growthFactor = 1 + (d / DAYS) * 0.5;
    const weekend      = d % 7 === 5 || d % 7 === 6;
    const seasonal     = 1 + (weekend ? 0.18 : -0.04);
    const spendDate    = new Date(startMs + d * DAY_MS)
      .toISOString().split("T")[0]!;

    for (const ch of CHANNELS) {
      const noise        = 0.82 + rng() * 0.36;
      const spendDollars = ch.base * growthFactor * seasonal * noise;
      const impressions  = Math.round((spendDollars / ch.cpm) * 1000);
      const clicks       = Math.round(impressions * ch.ctr * (0.9 + rng() * 0.2));
      const conversions  = Math.round(clicks * ch.cvr * (0.85 + rng() * 0.3));

      spendRows.push({
        userId,
        connectionId:         connId,
        platform:             ch.name,
        campaignId:           `demo-${ch.name}-${d}`,
        campaignName:         `Demo ${ch.name} Campaign`,
        spendDate,
        currency:             "USD",
        spendCents:           toCents(spendDollars),
        impressions,
        clicks,
        conversions,
        conversionValueCents: toCents(spendDollars * 3.2),
      });
    }
  }

  for (let i = 0; i < spendRows.length; i += 100) {
    await db.insert(normalizedAdSpend)
      .values(spendRows.slice(i, i + 100))
      .onConflictDoNothing();
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  await db.insert(alerts).values([
    {
      userId,
      severity: "success",
      title:    "Welcome to Clawjin Prism Demo",
      message:  "This is sample data. Connect your Shopify store to see your real numbers.",
      read:     false,
    },
    {
      userId,
      severity: "info",
      title:    "Blended ROAS: 3.8x",
      message:  "Your Meta campaigns are returning 3.8x on ad spend over the last 30 days.",
      read:     false,
    },
  ]).onConflictDoNothing();

  // ── Activity log ──────────────────────────────────────────────────────────
  await db.insert(activityLog).values([
    { userId, action: "demo.created",   detail: "Demo workspace initialized" },
    { userId, action: "shopify.synced", detail: "Synced 300 demo orders" },
    { userId, action: "meta.synced",    detail: "Synced 150 days of demo ad spend" },
  ]).onConflictDoNothing();

  console.log(`[seed] ✓ Demo workspace seeded for user ${userId}`);
}