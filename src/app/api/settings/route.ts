import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, users } from "@/db/schema";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // SECURITY: only profile fields are client-updatable. `plan` is managed
  // exclusively by billing (Stripe webhook / demo-upgrade) — never by the
  // client, otherwise a user could self-upgrade to Enterprise for free.
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 80);
  }
  if (typeof body.companyName === "string") {
    patch.companyName = body.companyName.trim().slice(0, 120);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, user.id))
    .returning();

  await db.insert(activityLog).values({
    userId: user.id,
    action: "settings.updated",
    detail: "Updated workspace settings",
  });

  return NextResponse.json({ user: toPublicUser(updated) });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(users).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
