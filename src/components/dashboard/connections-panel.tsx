"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Megaphone,
  Globe,
  Music2,
  Mail,
  ShoppingCart,
  CreditCard,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Loader2,
  Plug2,
  type LucideIcon,
} from "lucide-react";

export interface ConnectionItem {
  id: number;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}

interface ProviderMeta {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const PROVIDERS: ProviderMeta[] = [
  { id: "shopify", label: "Shopify", desc: "Orders, COGS & fulfillment", icon: ShoppingBag, color: "#95bf47" },
  { id: "meta", label: "Meta Ads", desc: "Facebook & Instagram spend", icon: Megaphone, color: "#0084ff" },
  { id: "google", label: "Google Ads", desc: "Search, shopping & PMax", icon: Globe, color: "#34a853" },
  { id: "tiktok", label: "TikTok Ads", desc: "Paid social & spark ads", icon: Music2, color: "#69c9d0" },
  { id: "klaviyo", label: "Klaviyo", desc: "Email & retention flows", icon: Mail, color: "#f97316" },
  { id: "amazon", label: "Amazon", desc: "Marketplace orders", icon: ShoppingCart, color: "#ff9900" },
  { id: "stripe", label: "Stripe", desc: "Payments & subscriptions", icon: CreditCard, color: "#635bff" },
];

function metaFor(provider: string): ProviderMeta {
  return (
    PROVIDERS.find((p) => p.id === provider) ?? {
      id: provider,
      label: provider,
      desc: "Integration",
      icon: Plug2,
      color: "#94a3b8",
    }
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

export function ConnectionsPanel({
  connections,
}: {
  connections: ConnectionItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const connected = new Set(connections.map((c) => c.provider));
  const available = PROVIDERS.filter((p) => !connected.has(p.id));

  async function run(action: string, fn: () => Promise<Response>) {
    setBusy(action);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addProvider(provider: string) {
    const meta = metaFor(provider);
    await run(`add-${provider}`, () =>
      fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, name: meta.label }),
      }),
    );
  }

  async function sync(id: number) {
    await run(`sync-${id}`, () =>
      fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync: true }),
      }),
    );
  }

  async function toggle(id: number, status: string) {
    await run(`toggle-${id}`, () =>
      fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    );
  }

  async function remove(id: number) {
    await run(`remove-${id}`, () =>
      fetch(`/api/connections/${id}`, { method: "DELETE" }),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">Connected sources</h2>
        <p className="text-xs text-zinc-400">
          The engine continuously ingests from these integrations into your warehouse.
        </p>
      </div>

      {connections.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {connections.map((c) => {
            const meta = metaFor(c.provider);
            const Icon = meta.icon;
            const paused = c.status === "paused";
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${meta.color}1f`, color: meta.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{c.name}</p>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        paused ? "bg-slate-500" : c.status === "pending" ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">{timeAgo(c.lastSyncAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Sync now"
                    onClick={() => sync(c.id)}
                    disabled={busy !== null}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {busy === `sync-${c.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title={paused ? "Resume" : "Pause"}
                    onClick={() => toggle(c.id, paused ? "connected" : "paused")}
                    disabled={busy !== null}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    {busy === `toggle-${c.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Disconnect"
                    onClick={() => remove(c.id)}
                    disabled={busy !== null}
                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                  >
                    {busy === `remove-${c.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">
          No sources connected yet. Add one below to start ingesting data.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-base font-semibold text-white">Add a source</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addProvider(p.id)}
                disabled={busy !== null}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${p.color}1f`, color: p.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{p.label}</p>
                  <p className="truncate text-xs text-zinc-400">{p.desc}</p>
                </div>
                {busy === `add-${p.id}` ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-white" />
                )}
              </button>
            );
          })}
          {available.length === 0 && (
            <p className="text-sm text-zinc-400">All available sources are connected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
