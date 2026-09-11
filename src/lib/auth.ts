// src/lib/auth.ts
// Authentication core.
//
// Token model (per AGENTS.md):
// → Access token: stateless JWT (15 min TTL), sent as httpOnly cookie.
// → Refresh token: opaque random string (30 days), stored HASHED in the
//   sessions table so logout/revocation actually works server-side.
//
// Passwords: Node built-in scrypt with per-user random salt.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import {
  signAccessToken,
  verifyAccessToken,
  ACCESS_TOKEN_MAX_AGE,
} from "@/lib/jwt";

export const ACCESS_COOKIE = "clawjin_at";
export const REFRESH_COOKIE = "clawjin_rt";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Password hashing — scrypt, zero external dependencies
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Token issuance — JWT access + DB-backed refresh
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issue a fresh token pair for a user.
 * Only the SHA-256 HASH of the refresh token is persisted.
 */
export async function createAuthTokens(
  user: Pick<User, "id" | "plan">,
  meta?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<AuthTokens> {
  const accessToken = await signAccessToken(user.id, user.plan);
  const refreshToken = crypto.randomBytes(32).toString("hex");

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: meta?.userAgent ?? null,
    ipAddress: meta?.ipAddress ?? null,
  });

  return { accessToken, refreshToken };
}

/** Rotate: revoke old refresh session, issue a new pair. */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  user: User
): Promise<AuthTokens | null> {
  const ok = await consumeRefreshToken(oldRefreshToken);
  if (!ok) return null;
  return createAuthTokens(user);
}

/** Validate + burn a refresh token (single use). */
export async function consumeRefreshToken(token: string): Promise<boolean> {
  const tokenHash = sha256(token);
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!session) return false;
  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return false;
  }

  await db.delete(sessions).where(eq(sessions.id, session.id));
  return true;
}

export async function destroySession(refreshToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(refreshToken)));
}

// ---------------------------------------------------------------------------
// Cookie helpers — route handlers call these on login/logout/refresh
// ---------------------------------------------------------------------------

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAuthCookies(
  res: NextResponse,
  tokens: AuthTokens
): NextResponse {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...COOKIE_BASE,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...COOKIE_BASE,
    maxAge: REFRESH_TTL_SECONDS,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  return res;
}

// ---------------------------------------------------------------------------
// Current user resolution
// ---------------------------------------------------------------------------

async function userById(id: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/**
 * Resolve the current user from cookies.
 * 1. Try the stateless JWT access token (fast path — no DB hit).
 * 2. Fall back to the hashed refresh token in the sessions table
 *    (covers expired access tokens between rotations).
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();

  const at = store.get(ACCESS_COOKIE)?.value;
  if (at) {
    const claims = await verifyAccessToken(at);
    if (claims) {
      const user = await userById(Number(claims.sub));
      if (user) return user;
    }
  }

  const rt = store.get(REFRESH_COOKIE)?.value;
  if (rt) {
    const tokenHash = sha256(rt);
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return null;
    }

    return userById(session.userId);
  }

  return null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Backward-compatible alias used by older routes.
export { ACCESS_COOKIE as SESSION_COOKIE };

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyName: user.companyName,
    plan: user.plan,
    trialEndsAt: user.trialEndsAt,
    createdAt: user.createdAt,
  };
}
