// src/app/dashboard/connections/page.tsx
// Clawjin Prism — Data Sources page

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  ConnectionsPanel,
  type ConnectionItem,
} from "@/components/dashboard/connections-panel";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.userId, user.id))
    .orderBy(desc(platformConnections.createdAt));

  const items: ConnectionItem[] = rows.map((c) => ({
    id:         c.id,
    provider:   c.platform,       // ← component expects "provider", we map from platform
    name:       c.displayName,    // ← was c.name, now c.displayName
    status:     c.status,
    lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Data Sources
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Connect your commerce stack. Clawjin Prism ingests, normalises and
          alerts on your unified dataset across every platform.
        </p>
      </div>

      <ConnectionsPanel connections={items} />
    </div>
  );
}