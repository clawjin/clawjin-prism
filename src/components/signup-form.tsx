"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10 focus:bg-white/10";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Your name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Founder"
            className={inputClass}
            autoComplete="name"
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
            autoComplete="organization"
          />
        </div>
      </div>

      <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Work email
          </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbrand.com"
          className={inputClass}
          autoComplete="email"
        />
      </div>

      <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-200">
            Password
          </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={inputClass}
          autoComplete="new-password"
        />
        <p className="mt-1.5 text-xs text-zinc-400">
          Your workspace is provisioned with a realistic demo dataset so you can
          explore the engine instantly.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400 ring-1 ring-inset ring-rose-500/30">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-prism px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Create free account <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-zinc-400">
        Free 14-day trial · No credit card required
      </p>
    </form>
  );
}
