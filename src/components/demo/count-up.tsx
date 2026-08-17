"use client";

import { useEffect, useState } from "react";

export function CountUp({
  value,
  format,
  duration = 1200,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(n)}</>;
}
