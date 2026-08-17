"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10 focus:bg-white/10";

export function SettingsForm({
  user,
}: {
  user: { name: string; companyName: string; email: string; plan: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [companyName, setCompanyName] = useState(user.companyName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Could not save changes.");
      } else {
        setMessage("Saved.");
        router.refresh();
      }
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount() {
    if (!window.confirm("Delete your account and all workspace data? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await fetch("/api/settings", { method: "DELETE" });
      window.location.href = "/";
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Full name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Brand / company
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Skincare Co."
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Email
          </label>
          <input
            value={user.email}
            readOnly
            className={`${inputClass} text-zinc-500`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Plan
          </label>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
            <span className="capitalize text-white">{user.plan}</span>
            <a
              href="/dashboard/billing"
              className="text-xs font-semibold text-zinc-300 transition hover:text-white"
            >
              Manage →
            </a>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Plans are managed from the Billing page — upgrade, downgrade or update
            your payment method there.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-prism px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </button>
          {message && <span className="text-sm text-zinc-400">{message}</span>}
        </div>
      </form>

      <div className="max-w-xl rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
        <h3 className="text-sm font-semibold text-rose-400">Danger zone</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Permanently delete your account and all associated workspace data,
          including orders, spend, customers and integrations.
        </p>
        <button
          type="button"
          onClick={removeAccount}
          disabled={deleting}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete account
        </button>
      </div>
    </div>
  );
}
