export type Segment =
  | "vip"
  | "loyal"
  | "promising"
  | "new"
  | "at_risk"
  | "lost"
  | "active";

export interface SegmentInput {
  orderCount: number;
  totalSpend: number;
  recencyDays: number;
}

/**
 * RFM loyalty segmentation (recency / frequency / monetary).
 * Rules ordered from strongest signal to weakest.
 */
export function computeSegment({
  orderCount,
  totalSpend,
  recencyDays,
}: SegmentInput): Segment {
  if (totalSpend >= 400 || orderCount >= 4) return "vip";
  if (recencyDays > 120) return "lost";
  if (recencyDays > 60) return "at_risk";
  if (orderCount === 1 && recencyDays <= 30) return "new";
  if (orderCount >= 2) return "loyal";
  if (totalSpend >= 150) return "promising";
  return "active";
}

export const SEGMENT_LABELS: Record<Segment, string> = {
  vip: "VIP",
  loyal: "Loyal",
  promising: "Promising",
  new: "New",
  at_risk: "At risk",
  lost: "Lost",
  active: "Active",
};

// Monochrome ramp (white → gray), with muted amber/red reserved
// strictly for warning (at-risk) and danger (lost).
export const SEGMENT_COLORS: Record<Segment, string> = {
  vip: "#fafafa",
  loyal: "#d4d4d8",
  promising: "#9ca3af",
  new: "#63636e",
  at_risk: "#d9a441",
  lost: "#e06b6b",
  active: "#4b4b52",
};
