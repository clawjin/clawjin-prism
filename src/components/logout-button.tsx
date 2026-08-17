"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className={`inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      Sign out
    </button>
  );
}
