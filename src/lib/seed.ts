import { db } from "@/db";
import {
  activityLog,
  adSpend,
  alerts,
  connections,
  customers,
  orders,
} from "@/db/schema";
import { computeSegment } from "@/lib/segments";

// Deterministic PRNG so every seeded workspace looks stable and repeatable.
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
  "Ava", "Liam", "Maya", "Noah", "Zoe", "Ethan", "Isla", "Lucas", "Nora",
  "Mason", "Chloe", "Logan", "Ruby", "Elijah", "Sofia", "Carter", "Ivy",
  "Owen", "Lily", "Jackson", "Hazel", "Aiden", "Ella", "Grayson",
];

const LAST_NAMES = [
  "Chen", "Patel", "Kim", "Garcia", "Nguyen", "Smith", "Brown", "Lopez",
  "Davis", "Wilson", "Moore", "Taylor", "Martinez", "Anderson", "Thomas",
  "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green",
  "Baker",
];

const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"];

// Daily ad-spend bases are tuned so the seeded business is HEALTHY:
// revenue ≈ $670k, ad spend ≈ $230k → blended ROAS ≈ 2.9x, CAC ≈ $34,
// positive contribution margin. (Spend = base × growth × seasonal × noise.)
const CHANNELS = [
  { name: "Meta", base: 450, growth: 0.55, cpm: 11, ctr: 0.012, cvr: 0.027, weight: 0.44 },
  { name: "Google", base: 255, growth: 0.42, cpm: 8.5, ctr: 0.022, cvr: 0.034, weight: 0.3 },
  { name: "TikTok", base: 116, growth: 0.85, cpm: 6.2, ctr: 0.018, cvr: 0.019, weight: 0.26 },
];

const DAYS = 150;
const DAY_MS = 86_400_000;

function pickChannel(rng: () => number): string {
  const r = rng();
  let acc = 0;
  for (const c of CHANNELS) {
    acc += c.weight;
    if (r <= acc) return c.name;
  }
  return "Meta";
}

export async function seedWorkspace(userId: number) {
  const rng = mulberry32(0x9e3779b9 ^ userId);
  const now = new Date();
  const startMs = now.getTime() - DAYS * DAY_MS;

  // ---- Customers ------------------------------------------------------
  const customerCount = 2400;
  const custLocal: {
    email: string;
    name: string;
    firstOrderAt: Date;
    lastOrderAt: Date;
    orderCount: number;
    totalSpend: number;
    segment: string;
    orderRows: {
      orderNumber: string;
      revenue: number;
      cogs: number;
      shipping: number;
      channel: string;
      status: string;
      createdAt: Date;
    }[];
  }[] = [];

  for (let i = 0; i < customerCount; i++) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(rng() * 90) + 10}@${DOMAINS[Math.floor(rng() * DOMAINS.length)]}`;

    const r = rng();
    const orderCount =
      r < 0.28 ? 1 : r < 0.5 ? 2 : r < 0.72 ? 3 : r < 0.88 ? 4 : 5 + Math.floor(rng() * 4);
    const aov = 60 + rng() * 80;

    const firstDay = Math.floor(rng() * 138);
    const orderRows: typeof custLocal[number]["orderRows"] = [];
    let day = firstDay;
    for (let k = 0; k < orderCount; k++) {
      if (k === 0) day = firstDay;
      else day = day + 6 + Math.floor(rng() * 28);
      if (day > DAYS - 1) break;

      const revenue = Math.max(16, aov + (rng() - 0.5) * 34);
      const cogs = revenue * (0.3 + rng() * 0.08);
      const shipping = 4.9 + rng() * 7;
      const status = rng() < 0.965 ? "paid" : "refunded";
      orderRows.push({
        orderNumber: `ORD-${1000 + i * 10 + k}`,
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        channel: pickChannel(rng),
        status,
        createdAt: new Date(startMs + day * DAY_MS),
      });
    }

    if (orderRows.length === 0) orderRows.push(orderRows[0] ?? { orderNumber: `ORD-${i}`, revenue: 40, cogs: 14, shipping: 6, channel: "Meta", status: "paid", createdAt: new Date(startMs + firstDay * DAY_MS) });

    const paid = orderRows.filter((o) => o.status === "paid");
    const totalSpend = paid.reduce((s, o) => s + o.revenue, 0);
    const lastOrderAt = orderRows[orderRows.length - 1].createdAt;
    const recencyDays = Math.round((now.getTime() - lastOrderAt.getTime()) / DAY_MS);

    custLocal.push({
      email,
      name,
      firstOrderAt: orderRows[0].createdAt,
      lastOrderAt,
      orderCount: paid.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      segment: computeSegment({ orderCount: paid.length, totalSpend, recencyDays }),
      orderRows,
    });
  }

  const insertedCustomers = await db
    .insert(customers)
    .values(
      custLocal.map((c) => ({
        userId,
        email: c.email,
        name: c.name,
        firstOrderAt: c.firstOrderAt,
        lastOrderAt: c.lastOrderAt,
        orderCount: c.orderCount,
        totalSpend: c.totalSpend,
        segment: c.segment,
      })),
    )
    .returning({ id: customers.id });

  // ---- Orders (linked to real customer ids) ---------------------------
  const orderRowsFlat = custLocal.flatMap((c, idx) =>
    c.orderRows.map((o) => ({
      userId,
      customerId: insertedCustomers[idx].id,
      orderNumber: o.orderNumber,
      revenue: o.revenue,
      cogs: o.cogs,
      shipping: o.shipping,
      channel: o.channel,
      status: o.status,
      createdAt: o.createdAt,
    })),
  );
  await db.insert(orders).values(orderRowsFlat);

  // ---- Ad spend (daily grain per channel) -----------------------------
  const spendRows: typeof adSpend.$inferInsert[] = [];
  for (let d = 0; d < DAYS; d++) {
    // Mild growth (1x → 1.5x) so every trailing window — including "this month"
    // and "last 24 hours" — stays profitable and the demo reads as a healthy,
    // scaling brand instead of a loss-making one.
    const growthFactor = 1 + (d / DAYS) * 0.5;
    const weekend = d % 7 === 5 || d % 7 === 6;
    const seasonal = 1 + (weekend ? 0.18 : -0.04);
    for (const ch of CHANNELS) {
      const noise = 0.82 + rng() * 0.36;
      const spend = ch.base * growthFactor * seasonal * noise;
      const impressions = Math.round((spend / ch.cpm) * 1000);
      const clicks = Math.round(impressions * ch.ctr * (0.9 + rng() * 0.2));
      const conversions = Math.round(clicks * ch.cvr * (0.85 + rng() * 0.3));
      spendRows.push({
        userId,
        channel: ch.name,
        date: new Date(startMs + d * DAY_MS),
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        conversions,
      });
    }
  }
  await db.insert(adSpend).values(spendRows);

  // ---- Default integrations -------------------------------------------
  await db.insert(connections).values([
    { userId, provider: "shopify", name: "Shopify Orders", status: "connected", lastSyncAt: new Date(now.getTime() - 8 * 60_000) },
    { userId, provider: "meta", name: "Meta Ads", status: "connected", lastSyncAt: new Date(now.getTime() - 12 * 60_000) },
    { userId, provider: "google", name: "Google Ads", status: "connected", lastSyncAt: new Date(now.getTime() - 14 * 60_000) },
    { userId, provider: "tiktok", name: "TikTok Ads", status: "connected", lastSyncAt: new Date(now.getTime() - 20 * 60_000) },
    { userId, provider: "klaviyo", name: "Klaviyo Email", status: "pending", lastSyncAt: null },
  ]);

  // ---- Executive briefing alerts ---------------------------------------
  await db.insert(alerts).values([
    { userId, severity: "critical", title: "Blended CAC up 12.4% week-over-week", message: "Total ad spend outpaced completed orders. Meta CPMs rose 9% while conversion rate fell to 2.3%. Review the Meta prospecting budget.", read: false },
    { userId, severity: "warning", title: "TikTok ROAS slipped below 1.5x", message: "TikTok blended ROAS is 1.42x over the last 7 days. Consider pausing underperforming creative sets.", read: false },
    { userId, severity: "success", title: "30-day cohort retention up 3.1pts", message: "The latest monthly cohort is repurchasing at 34.2% by day 30 — a 3.1 point lift versus the previous cohort.", read: false },
    { userId, severity: "info", title: "Daily ingestion completed", message: "148 orders and 3 channel spend feeds synced at 06:00 UTC. All dbt marts refreshed successfully.", read: true },
  ]);

  // ---- Activity log ----------------------------------------------------
  await db.insert(activityLog).values([
    { userId, action: "ingestion.run", detail: "Synced Shopify orders + 3 ad channels (148 rows)" },
    { userId, action: "dbt.run", detail: "Refreshed fct_daily_unit_economics + cohort marts" },
    { userId, action: "briefing.dispatch", detail: "Daily executive briefing delivered" },
    { userId, action: "workspace.create", detail: "Provisioned new workspace with demo dataset" },
  ]);
}
