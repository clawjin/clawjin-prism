// Unit tests — UTC-safe date helpers + email hashing + segments + JWT.

import { describe, expect, it, beforeAll } from "vitest";
import {
  utcDayKey,
  utcMonthIndex,
  eachDay,
  isValidDayKey,
  daysAgoUtc,
  todayUtc,
} from "@/lib/dates";
import { hashEmail } from "@/lib/hash";
import { computeSegment } from "@/lib/segments";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";

describe("dates (UTC safety)", () => {
  it("utcDayKey uses UTC parts regardless of server timezone", () => {
    // A timestamp that is "Aug 16" in UTC but "Aug 15" in US timezones
    const d = new Date("2026-08-16T00:30:00Z");
    expect(utcDayKey(d)).toBe("2026-08-16");
  });

  it("month index is UTC-based and reversible", () => {
    const idx = utcMonthIndex(new Date("2026-08-16T23:00:00Z"));
    expect(idx).toBe(2026 * 12 + 7);
    const back = new Date(
      Date.UTC(Math.floor(idx / 12), idx % 12, 1)
    );
    expect(back.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("eachDay is inclusive on both ends", () => {
    expect(eachDay("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02",
    ]);
  });

  it("isValidDayKey rejects garbage", () => {
    expect(isValidDayKey("2026-13-45")).toBe(false);
    expect(isValidDayKey("hello")).toBe(false);
    expect(isValidDayKey(123)).toBe(false);
    expect(isValidDayKey("2026-08-15")).toBe(true);
  });

  it("daysAgoUtc/todayUtc are consistent", () => {
    const today = todayUtc();
    const yesterday = daysAgoUtc(1);
    expect(Date.parse(`${today}T00:00:00Z`) - Date.parse(`${yesterday}T00:00:00Z`))
      .toBe(86_400_000);
  });
});

describe("hashEmail (HMAC)", () => {
  beforeAll(() => {
    process.env.EMAIL_HASH_SECRET = process.env.EMAIL_HASH_SECRET ?? "unit-test-secret";
  });

  it("is deterministic for the same input", () => {
    expect(hashEmail("a@b.com")).toBe(hashEmail("a@b.com"));
  });

  it("normalizes case + whitespace", () => {
    expect(hashEmail("Jane.Doe@Example.COM ")).toBe(hashEmail("jane.doe@example.com"));
  });

  it("differs from plain sha256 (salted)", () => {
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const plain = crypto.createHash("sha256").update("jane.doe@example.com").digest("hex");
    expect(hashEmail("jane.doe@example.com")).not.toBe(plain);
  });

  it("handles null/empty safely", () => {
    expect(hashEmail(null)).toBeNull();
    expect(hashEmail("")).toBeNull();
    expect(hashEmail("   ")).toBeNull();
  });
});

describe("segments (RFM)", () => {
  it("VIP: high spend or high frequency wins first", () => {
    expect(computeSegment({ orderCount: 5, totalSpend: 100, recencyDays: 3 })).toBe("vip");
    expect(computeSegment({ orderCount: 1, totalSpend: 500, recencyDays: 200 })).toBe("vip");
  });

  it("lost beats loyalty when recency collapses", () => {
    expect(computeSegment({ orderCount: 3, totalSpend: 90, recencyDays: 150 })).toBe("lost");
    expect(computeSegment({ orderCount: 3, totalSpend: 90, recencyDays: 70 })).toBe("at_risk");
  });

  it("single recent buyer → new; repeat → loyal", () => {
    expect(computeSegment({ orderCount: 1, totalSpend: 40, recencyDays: 10 })).toBe("new");
    expect(computeSegment({ orderCount: 2, totalSpend: 80, recencyDays: 20 })).toBe("loyal");
  });
});

describe("JWT access tokens", () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "jwt-unit-secret";
  });

  it("round-trips claims", async () => {
    const token = await signAccessToken(42, "growth");
    const claims = await verifyAccessToken(token);
    expect(claims?.sub).toBe("42");
    expect(claims?.plan).toBe("growth");
  });

  it("rejects tampered tokens", async () => {
    const token = await signAccessToken(42, "growth");
    const claims = await verifyAccessToken(token + "x");
    expect(claims).toBeNull();
  });
});
