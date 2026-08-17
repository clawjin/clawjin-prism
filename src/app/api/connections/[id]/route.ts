import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, connections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const connId = Number(id);
  if (!Number.isInteger(connId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connId), eq(connections.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status === "connected" || body.status === "paused") {
    patch.status = body.status;
  }
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 80);
  }
  if (body.sync === true) {
    patch.lastSyncAt = new Date();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(connections)
    .set(patch)
    .where(eq(connections.id, connId))
    .returning();

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.updated",
    detail: `Updated ${updated.name}`,
  });

  return NextResponse.json({ connection: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const connId = Number(id);
  if (!Number.isInteger(connId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connId), eq(connections.userId, user.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.delete(connections).where(eq(connections.id, connId));

  await db.insert(activityLog).values({
    userId: user.id,
    action: "connection.removed",
    detail: `Disconnected ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
