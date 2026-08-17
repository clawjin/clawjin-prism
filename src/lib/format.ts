export function formatCurrency(value: number, opts: { compact?: boolean } = {}) {
  const { compact = false } = opts;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (compact && abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (compact && abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: abs < 100 ? 2 : 0,
    maximumFractionDigits: abs < 100 ? 2 : 0,
  })}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function formatMultiplier(value: number, digits = 2) {
  return `${value.toFixed(digits)}x`;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function monthLabel(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
