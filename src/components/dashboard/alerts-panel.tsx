"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  CheckCheck,
} from "lucide-react";

export interface AlertItem {
  id: number;
  title: string;
  message: string;
  severity: "critical" | "warning" | "success" | "info";
  read: boolean;
  time: string;
}

const SEVERITY_META: Record<
  AlertItem["severity"],
  { icon: typeof Info; ring: string; iconColor: string; label: string }
> = {
  critical: { icon: AlertTriangle, ring: "ring-rose-500/30 bg-rose-500/10", iconColor: "text-rose-400", label: "Critical" },
  warning: { icon: AlertCircle, ring: "ring-amber-500/30 bg-amber-500/10", iconColor: "text-amber-400", label: "Warning" },
  success: { icon: CheckCircle2, ring: "ring-emerald-500/30 bg-emerald-500/10", iconColor: "text-emerald-400", label: "Good" },
  info: { icon: Info, ring: "ring-zinc-500/30 bg-zinc-500/10", iconColor: "text-zinc-400", label: "Info" },
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | "all" | null>(null);

  async function markRead(id: number) {
    setBusy(id);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function markAll() {
    setBusy("all");
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Alerts</h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-white disabled:opacity-60"
          >
            {busy === "all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {alerts.map((a) => {
          const meta = SEVERITY_META[a.severity] ?? SEVERITY_META.info;
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className={`flex gap-3 rounded-2xl border p-4 transition ${
                a.read
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.ring}`}
              >
                <Icon className={`h-4.5 w-4.5 h-[18px] w-[18px] ${meta.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm font-medium ${a.read ? "text-zinc-400" : "text-white"}`}>
                    {a.title}
                  </p>
                  <span className="shrink-0 text-xs text-zinc-500">{a.time}</span>
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${a.read ? "text-zinc-500" : "text-zinc-400"}`}>
                  {a.message}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {meta.label}
                  </span>
                  {!a.read && (
                    <button
                      type="button"
                      onClick={() => markRead(a.id)}
                      disabled={busy !== null}
                      className="text-xs font-medium text-white transition hover:text-white disabled:opacity-60"
                    >
                      {busy === a.id ? "Marking…" : "Mark as read"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-zinc-400">
            All caught up — no alerts right now.
          </div>
        )}
      </div>
    </div>
  );
}
