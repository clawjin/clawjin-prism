import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema";
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
    .from(connections)
    .where(eq(connections.userId, user.id))
    .orderBy(desc(connections.createdAt));

  const items: ConnectionItem[] = rows.map((c) => ({
    id: c.id,
    provider: c.provider,
    name: c.name,
    status: c.status,
    lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Data sources
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Connect your commerce stack. Clawjin Prism ingests, models and alerts
          on the unified dataset.
        </p>
      </div>

      <ConnectionsPanel connections={items} />
    </div>
  );
}
