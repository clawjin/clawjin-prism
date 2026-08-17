"use client";

import { useEffect, useRef, useState } from "react";
import { Card, DeltaBadge } from "@/components/ui";
import {
  formatCurrency,
  formatMultiplier,
  formatPercent,
} from "@/lib/format";

type FormatKind = "currency" | "currencyCompact" | "multiplier" | "percent";

function formatValue(kind: FormatKind, n: number): string {
  switch (kind) {
    case "currencyCompact":
      return formatCurrency(n, { compact: true });
    case "multiplier":
      return formatMultiplier(n);
    case "percent":
      return formatPercent(n);
    case "currency":
    default:
      return formatCurrency(n);
  }
}

export function AnimatedStatCard({
  label,
  value,
  format = "currency",
  sub,
  delta,
  goodWhenDown,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  format?: FormatKind;
  sub?: string;
  delta?: number;
  goodWhenDown?: boolean;
  accent?: string;
  delay?: number;
}) {
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let raf = 0;
    const startTime = performance.now() + delay;
    const duration = 1100;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay]);

  return (
    <Card className="rise group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(255,255,255,0.25)]">
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          {delta !== undefined && <DeltaBadge value={delta} goodWhenDown={goodWhenDown} />}
        </div>
        <p
          className="mt-2 text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: accent ?? "#ffffff" }}
        >
          {formatValue(format, n)}
        </p>
        {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      </div>
    </Card>
  );
}
