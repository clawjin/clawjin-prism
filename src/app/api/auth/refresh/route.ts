// src/app/api/auth/refresh/route.ts
// Rotate the JWT access token using the DB-backed refresh token.
// Refresh tokens are single-use: old row consumed, new pair issued.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  REFRESH_COOKIE,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth";

export async function POST() {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token." }, { status: 401 });
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  // Resolve owner BEFORE consuming (consume deletes the row)
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
    }
    return NextResponse.json(
      { error: "Invalid or expired refresh token." },
      { status: 401 }
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 401 });
  }

  const tokens = await rotateRefreshToken(refreshToken, user);
  if (!tokens) {
    return NextResponse.json({ error: "Refresh failed." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  return setAuthCookies(res, tokens);
}
