// Unit tests — money math. All values integer cents; divide-by-zero safe.

import { describe, expect, it } from "vitest";
import {
  toCents,
  calculateRoasScaled,
  calculateCtrBasisPoints,
  calculateCpcCents,
  calculateCacCents,
  calculateAovCents,
  calculateCpmCents,
  calculateChangeBasisPoints,
  formatMoney,
  formatRoas,
  safeAdd,
} from "@/lib/money";

describe("toCents", () => {
  it("converts dollar strings", () => {
    expect(toCents("150.00")).toBe(15000);
    expect(toCents("12.5")).toBe(1250);
    expect(toCents("$1,299.99")).toBe(129999);
  });

  it("converts numbers without float drift", () => {
    expect(toCents(9.99)).toBe(999);
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
  });

  it("handles garbage safely", () => {
    expect(toCents("abc")).toBe(0);
    expect(toCents(NaN)).toBe(0);
    expect(toCents(Infinity)).toBe(0);
  });
});

describe("ratio metrics", () => {
  it("ROAS: $150 revenue on $12.50 spend = 12x", () => {
    expect(calculateRoasScaled(15000, 1250)).toBe(1200);
    expect(formatRoas(1200)).toBe("12.00x");
  });

  it("ROAS zero spend → 0, never NaN/Infinity", () => {
    expect(calculateRoasScaled(15000, 0)).toBe(0);
  });

  it("CTR basis points", () => {
    expect(calculateCtrBasisPoints(45, 1000)).toBe(450); // 4.5%
    expect(calculateCtrBasisPoints(45, 0)).toBe(0);
  });

  it("CPC", () => {
    expect(calculateCpcCents(1250, 45)).toBe(28);
    expect(calculateCpcCents(1250, 0)).toBe(0);
  });

  it("CAC uses NEW customers only", () => {
    expect(calculateCacCents(15000, 10)).toBe(1500);
    expect(calculateCacCents(15000, 0)).toBe(0); // no customers → 0 not crash
  });

  it("AOV", () => {
    expect(calculateAovCents(150000, 50)).toBe(3000);
    expect(calculateAovCents(150000, 0)).toBe(0);
  });

  it("CPM", () => {
    expect(calculateCpmCents(1250, 10000)).toBe(125);
    expect(calculateCpmCents(1250, 0)).toBe(0);
  });
});

describe("change basis points", () => {
  it("computes percentage change", () => {
    expect(calculateChangeBasisPoints(15000, 12000)).toBe(2500); // +25%
    expect(calculateChangeBasisPoints(6000, 12000)).toBe(-5000); // -50%
  });

  it("zero previous → 0 (no div by zero)", () => {
    expect(calculateChangeBasisPoints(15000, 0)).toBe(0);
  });
});

describe("formatting", () => {
  it("formats USD", () => {
    expect(formatMoney(15000)).toBe("$150.00");
    expect(formatMoney(-500)).toBe("-$5.00");
  });
});

describe("safeAdd", () => {
  it("ignores null/undefined/NaN", () => {
    expect(safeAdd(1, null, 2, undefined, NaN, 3)).toBe(6);
  });
});
