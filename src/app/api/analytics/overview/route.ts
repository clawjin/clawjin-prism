// src/app/api/analytics/overview/route.ts
// Clawjin Prism — Analytics Overview API
// Returns real data if connected, empty state if not

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getOverview } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user has any active connections
    const connections = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.userId, user.id));

    const activeConnections = connections.filter(
      (c) => c.status === "active"
    );

    // No connections → return empty state
    if (activeConnections.length === 0) {
      return NextResponse.json({
        state:       "empty",
        message:     "Connect your first platform to see your data",
        connections: [],
        metrics:     null,
        trend:       [],
        channels:    [],
      });
    }

    // Has connections → return real analytics
    const overview = await getOverview(user.id);

    return NextResponse.json({
      state:       "active",
      connections: activeConnections.map((c) => ({
        id:          c.id,
        platform:    c.platform,
        displayName: c.displayName,
        status:      c.status,
        lastSyncAt:  c.lastSyncAt,
      })),
      ...overview,
    });

  } catch (err) {
    console.error("[analytics/overview] Error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}