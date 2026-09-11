// src/app/api/connections/[id]/route.ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, platformConnections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req:     Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const connId  = Number(id);
  if (!Number.isInteger(connId) || connId <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Only allow updating these fields
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.displayName === "string") {
    patch.displayName = body.displayName.trim().slice(0, 80);
  }
  if (typeof body.status === "string") {
    patch.status = body.status;
  }

  const [updated] = await db
    .update(platformConnections)
    .set(patch)
    .where(
      and(
        eq(platformConnections.id,     connId),
        eq(platformConnections.userId, user.id) // MUST check userId — tenant isolation
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.updated",
    detail: `Updated ${updated.displayName}`, // ← was updated.name
  });

  return NextResponse.json({ connection: updated });
}

export async function DELETE(
  _req:    Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const connId  = Number(id);
  if (!Number.isInteger(connId) || connId <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Fetch first to log the name before deleting
  const [existing] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.id,     connId),
        eq(platformConnections.userId, user.id) // tenant isolation
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db
    .delete(platformConnections)
    .where(
      and(
        eq(platformConnections.id,     connId),
        eq(platformConnections.userId, user.id)
      )
    );

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.removed",
    detail: `Disconnected ${existing.displayName}`, // ← was existing.name
  });

  return NextResponse.json({ ok: true });
}