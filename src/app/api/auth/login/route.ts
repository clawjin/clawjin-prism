// src/app/api/auth/login/route.ts
// Clawjin Prism — Login API

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createAuthTokens,
  setAuthCookies,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);

    if (!rateLimit(`login:${ip}`, 10, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
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

    const email    = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 400 }
      );
    }

    // Look up user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Issue token pair (JWT access + DB-backed refresh)
    const tokens = await createAuthTokens(user, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: ip,
    });

    const res = NextResponse.json({ user: toPublicUser(user) });
    return setAuthCookies(res, tokens);

  } catch (err) {
    // Log full error so we can see it in terminal
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}