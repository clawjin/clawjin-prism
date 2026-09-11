// src/app/api/auth/signup/route.ts
// Clawjin Prism — Signup API
// Creates clean empty account — no fake data injected
// Real data comes from connecting Shopify/Meta

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createAuthTokens,
  hashPassword,
  setAuthCookies,
  toPublicUser,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);

    if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Too many accounts created. Try again later." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const email       = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    const password    = String(body.password ?? "");
    const name        = String(body.name ?? "").trim().slice(0, 80);
    const companyName = String(body.companyName ?? "").trim().slice(0, 120);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password.length > 128) {
      return NextResponse.json(
        { error: "Password must be 128 characters or fewer." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Create clean account — no fake data
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashPassword(password),
        name,
        companyName:  companyName || "",
        plan:         "trial",
        trialEndsAt:  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    console.log("[signup] New account created:", user!.email);

    // Issue token pair (JWT access + DB-backed refresh)
    const tokens = await createAuthTokens(user!, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: ip,
    });

    const res = NextResponse.json(
      { user: toPublicUser(user!) },
      { status: 201 }
    );

    return setAuthCookies(res, tokens);

  } catch (err) {
    console.error("[signup] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}