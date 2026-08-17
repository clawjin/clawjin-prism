import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id="prism-chrome"
          x1="4"
          y1="6"
          x2="36"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#d4d4d8" />
          <stop offset="1" stopColor="#a1a1aa" />
        </linearGradient>
      </defs>
      {/* chrome prism refracting light */}
      <path
        d="M20 5 L35 32 H5 Z"
        stroke="url(#prism-chrome)"
        strokeWidth="2"
        fill="rgba(255,255,255,0.06)"
      />
      <path
        d="M12.5 13.5 L20 5 L27.5 13.5"
        stroke="url(#prism-chrome)"
        strokeWidth="1.5"
        opacity="0.55"
      />
    </svg>
  );
}

export function Logo({
  className = "text-lg",
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <LogoMark className="h-8 w-8" />
      <span className={`font-semibold tracking-tight text-white ${className}`}>
        Clawjin <span className="text-gradient">Prism</span>
      </span>
    </Link>
  );
}

type Tone = "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

const TONE_CLASSES: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/30",
  amber: "bg-amber-500/10 text-amber-400 ring-amber-400/30",
  rose: "bg-rose-500/10 text-rose-400 ring-rose-400/30",
  sky: "bg-white/10 text-white ring-white/20",
  violet: "bg-white/10 text-white ring-white/20",
  slate: "bg-white/10 text-zinc-300 ring-white/15",
};

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`glass rounded-2xl ${className}`} style={style}>
      {children}
    </div>
  );
}

export function DeltaBadge({
  value,
  goodWhenDown = false,
}: {
  value: number;
  goodWhenDown?: boolean;
}) {
  const up = value >= 0;
  const good = goodWhenDown ? !up : up;
  const tone =
    Math.abs(value) < 0.05
      ? "text-zinc-500"
      : good
        ? "text-emerald-400"
        : "text-rose-400";
  const arrow = up ? "▲" : "▼";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${tone}`}
    >
      <span className="text-[9px]">{arrow}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  goodWhenDown,
  accent,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  goodWhenDown?: boolean;
  accent?: string;
  delay?: number;
}) {
  return (
    <Card
      className="rise group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(255,255,255,0.25)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          {delta !== undefined && <DeltaBadge value={delta} goodWhenDown={goodWhenDown} />}
        </div>
        <p
          className="mt-2 text-3xl font-semibold tracking-tight text-white tabular-nums"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      </div>
    </Card>
  );
}
