"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw } from "lucide-react";

export function PipelineButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    setDone(false);
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
        window.setTimeout(() => setDone(false), 2600);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {busy ? "Syncing…" : done ? "Synced" : "Sync data"}
    </button>
  );
}
