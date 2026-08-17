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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Too many accounts created from this address. Try again later." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 80);
  const companyName = String(body.companyName ?? "").trim().slice(0, 120);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "Password must be 128 characters or fewer." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(password),
      name,
      companyName: companyName || "",
      plan: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  // Seed the workspace with a realistic demo dataset (never fail the signup).
  try {
    await seedWorkspace(user.id);
  } catch (err) {
    console.error("Failed to seed workspace", err);
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
