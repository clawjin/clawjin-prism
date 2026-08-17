import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSession,
  hashPassword,
  SESSION_COOKIE,
  toPublicUser,
} from "@/lib/auth";
import { seedWorkspace } from "@/lib/seed";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const DEMO_EMAIL = "demo@clawjinprism.com";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`demo:${ip}`, 30, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }
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
        plan: "trial",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    try {
      await seedWorkspace(user.id);
    } catch (err) {
      console.error("Failed to seed demo workspace", err);
    }
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
