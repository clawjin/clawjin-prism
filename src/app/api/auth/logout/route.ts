import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  createAuthTokens,
  destroySession,
  REFRESH_COOKIE,
  setAuthCookies,
} from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;
  if (token) await destroySession(token);

  const res = NextResponse.json({ ok: true });
  return clearAuthCookies(res);
}
