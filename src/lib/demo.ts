import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { seedWorkspace } from "@/lib/seed";

const DEMO_EMAIL = "demo@clawjinprism.com";

/**
 * Ensures a seeded demo workspace exists (creating it on first run) and
 * returns its user id. Used by the public, no-auth "/demo" product tour so
 * visitors always see real, live-computed analytics.
 */
export async function ensureDemoWorkspace(): Promise<number> {
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash: hashPassword("demo-password"),
        name: "Demo Founder",
        companyName: "Acme Skincare Co.",
        plan: "pro",
      })
      .returning();
  }

  const hasData = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.userId, user.id))
    .limit(1);

  if (hasData.length === 0) {
    try {
      await seedWorkspace(user.id);
    } catch (err) {
      console.error("Failed to seed demo workspace", err);
    }
  }

  return user.id;
}
