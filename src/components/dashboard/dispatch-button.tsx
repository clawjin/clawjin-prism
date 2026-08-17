"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";

export function DispatchButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function dispatch() {
    if (busy) return;
    setBusy(true);
    setDone(false);
    try {
      const res = await fetch("/api/briefing/dispatch", { method: "POST" });
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
      onClick={dispatch}
      disabled={busy}
      className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-prism px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {busy ? "Sending…" : done ? "Dispatched" : "Dispatch now"}
    </button>
  );
}
