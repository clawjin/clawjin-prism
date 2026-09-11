// src/lib/jwt.ts
// Stateless JWT access tokens (AGENTS.md: "Access tokens are stateless JWT").
// Signed with HS256 via `jose` (works on Node + Edge runtimes).
// Refresh tokens are opaque random strings stored HASHED in the sessions
// table — see src/lib/auth.ts.

import { SignJWT, jwtVerify } from "jose";

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes

function getAccessSecret(): Uint8Array {
  const secret =
    process.env.JWT_ACCESS_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "[jwt] JWT_ACCESS_SECRET (or ENCRYPTION_KEY fallback) is not set."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface AccessClaims {
  sub: string; // user id
  plan: string;
}

export async function signAccessToken(
  userId: number,
  plan: string
): Promise<string> {
  return new SignJWT({ plan })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(getAccessSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      plan: typeof payload.plan === "string" ? payload.plan : "trial",
    };
  } catch {
    return null; // expired, tampered, or wrong key
  }
}

export const ACCESS_TOKEN_MAX_AGE = ACCESS_TTL_SECONDS;
