import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.all === true) {
    await db
      .update(alerts)
      .set({ read: true })
      .where(eq(alerts.userId, user.id));
    return NextResponse.json({ ok: true });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Scope the update to the signed-in user's own alerts (prevents IDOR).
  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db
    .update(alerts)
    .set({ read: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)));
  return NextResponse.json({ ok: true });
}
