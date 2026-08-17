"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

/* ============================================================
   AuroraBackground — monochrome light field + grain
   ============================================================ */

export function AuroraBackground({
  subtle = false,
  grain = true,
  className = "",
}: {
  subtle?: boolean;
  grain?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div
        className="mesh absolute inset-0"
        style={{ opacity: subtle ? 0.55 : 1 }}
      />

      {/* twinkling starfield */}
      <Starfield subtle={subtle} />

      {/* soft monochrome orbs */}
      <div
        className="orb orb-float-a"
        style={{
          width: "44rem",
          height: "44rem",
          top: "-14rem",
          left: "-12rem",
          background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 66%)",
          opacity: subtle ? 0.5 : 1,
        }}
      />
      <div
        className="orb orb-float-b"
        style={{
          width: "38rem",
          height: "38rem",
          top: "4%",
          right: "-15rem",
          background: "radial-gradient(circle, rgba(190,190,200,0.12), transparent 66%)",
          opacity: subtle ? 0.5 : 1,
        }}
      />
      <div
        className="orb orb-float-c"
        style={{
          width: "36rem",
          height: "36rem",
          bottom: "-16rem",
          left: "22%",
          background: "radial-gradient(circle, rgba(255,255,255,0.10), transparent 66%)",
          opacity: subtle ? 0.5 : 1,
        }}
      />
      <div
        className="orb orb-float-a"
        style={{
          width: "26rem",
          height: "26rem",
          top: "30%",
          left: "38%",
          background: "radial-gradient(circle, rgba(150,150,165,0.1), transparent 66%)",
          opacity: subtle ? 0.4 : 0.8,
          animationDelay: "-8s",
        }}
      />

      {grain && <div className="grain absolute inset-0" />}
    </div>
  );
}

// Deterministic star positions so the sky is stable across renders.
const STARS = [
  [6, 14, 2, 0], [12, 8, 1, 2], [22, 4, 2, 4], [31, 11, 1, 1], [43, 5, 2, 3],
  [55, 9, 1, 5], [66, 3, 2, 2], [77, 12, 1, 4], [86, 6, 2, 1], [94, 15, 1, 3],
  [9, 26, 1, 3], [18, 33, 2, 0], [28, 41, 1, 5], [39, 28, 1, 2], [50, 38, 2, 4],
  [61, 22, 1, 1], [72, 31, 2, 3], [84, 27, 1, 5], [92, 36, 2, 0], [97, 22, 1, 2],
  [4, 55, 2, 4], [15, 63, 1, 1], [26, 71, 1, 3], [37, 58, 2, 5], [48, 67, 1, 0],
  [59, 51, 2, 2], [70, 60, 1, 4], [81, 55, 2, 1], [90, 63, 1, 3], [96, 55, 1, 5],
  [8, 82, 1, 1], [20, 90, 2, 3], [33, 79, 1, 4], [45, 88, 2, 0], [57, 82, 1, 2],
  [68, 90, 2, 5], [80, 80, 1, 1], [91, 88, 2, 3],
];

function Starfield({ subtle = false }: { subtle?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ opacity: subtle ? 0.4 : 1 }}
    >
      {STARS.map(([x, y, size, delay], i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            animationDelay: `${delay}s`,
            animationDuration: `${4 + (i % 4)}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   SpotlightCard — mouse-follow white highlight
   ============================================================ */

export function SpotlightCard({
  children,
  className = "",
  color = "255, 255, 255",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spot-color", color);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`spotlight ${className}`}
      style={{ "--spot-color": color } as CSSProperties}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Parallax — subtle mouse-follow translate
   ============================================================ */

export function Parallax({
  children,
  className = "",
  strength = 16,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
  }

  function handleLeave() {
    if (ref.current) ref.current.style.transform = "translate3d(0,0,0)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{ transition: "transform 0.45s cubic-bezier(0.16,1,0.3,1)", willChange: "transform" }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   FloatingChip — glass badge that drifts in place
   ============================================================ */

export function FloatingChip({
  children,
  className = "",
  variant = "bob",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  variant?: "bob" | "sway";
  delay?: number;
}) {
  return (
    <div
      className={`floating-chip ${variant === "bob" ? "chip-bob" : "chip-sway"} ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   Reveal — fade-up on scroll into view
   ============================================================ */

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
