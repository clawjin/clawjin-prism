// src/lib/demo.ts
// Clawjin Prism — Demo Workspace Manager
// Ensures a seeded demo workspace exists for the public demo tour

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { normalizedOrders, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { seedWorkspace } from "@/lib/seed";

const DEMO_EMAIL = "demo@clawjinprism.com";

export async function ensureDemoWorkspace(): Promise<number> {
  // Check if demo user already exists
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  // Create demo user if not exists
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email:        DEMO_EMAIL,
        passwordHash: hashPassword("demo-password-not-for-login"),
        name:         "Demo Founder",
        companyName:  "Acme Skincare Co.",
        plan:         "growth",  // ← was "pro", now valid enum value
        trialEndsAt:  new Date(Date.now() + 99 * 24 * 60 * 60 * 1000),
      })
      .returning();
  }

  // Check if demo data already seeded
  const hasData = await db
    .select({ id: normalizedOrders.id })  // ← was orders.id (old schema)
    .from(normalizedOrders)               // ← was orders (old schema)
    .where(eq(normalizedOrders.userId, user.id))
    .limit(1);

  // Seed if no data exists
  if (hasData.length === 0) {
    try {
      await seedWorkspace(user.id);
    } catch (err) {
      console.error("[demo] Failed to seed workspace:", err);
      throw err; // re-throw so demo page shows real error
    }
  }

  return user.id;
}