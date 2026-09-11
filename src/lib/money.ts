// src/lib/money.ts
// ALL money math happens here. Never import float math for money anywhere else.
// Rule: Store cents (integer), display dollars (string), calculate in cents

/**
 * Convert dollar string/number from API to integer cents
 * "150.00" → 15000
 * "12.5"   → 1250
 * 9.99     → 999
 */
export function toCents(dollars: string | number): number {
  if (typeof dollars === "string") {
    // Remove currency symbols if present
    const cleaned = dollars.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    // Round to avoid floating point: 12.5 * 100 = 1249.9999...
    return Math.round(parsed * 100);
  }
  if (typeof dollars === "number") {
    if (isNaN(dollars) || !isFinite(dollars)) return 0;
    return Math.round(dollars * 100);
  }
  return 0;
}

/**
 * Convert integer cents to display string
 * 15000 → "$150.00"
 * 1250  → "$12.50"
 * -500  → "-$5.00"
 */
export function formatMoney(
  cents: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Convert cents to plain number for charting
 * 15000 → 150.00 (number, not string)
 * Use ONLY for chart data, never for calculations
 */
export function centsToDisplay(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Calculate ROAS safely
 * Returns scaled integer: 12.5x ROAS = 1250
 * Never returns float
 * 
 * spendCents: 1250  (= $12.50)
 * revenueCents: 15000 (= $150.00)
 * result: 1200 (= 12.00x)
 */
export function calculateRoasScaled(
  revenueCents: number,
  spendCents: number
): number {
  if (spendCents <= 0) return 0;
  // Multiply first to keep precision, divide after
  // 15000 * 100 / 1250 = 1200 (= 12.00x when divided by 100)
  return Math.round((revenueCents * 100) / spendCents);
}

/**
 * Display ROAS from scaled integer
 * 1200 → "12.00x"
 * 1250 → "12.50x"
 */
export function formatRoas(roasScaled: number): string {
  return `${(roasScaled / 100).toFixed(2)}x`;
}

/**
 * Calculate CTR in basis points
 * 4.5% CTR = 450 basis points
 * 
 * clicks: 45
 * impressions: 1000
 * result: 450 (= 4.50%)
 */
export function calculateCtrBasisPoints(
  clicks: number,
  impressions: number
): number {
  if (impressions <= 0) return 0;
  return Math.round((clicks * 10000) / impressions);
}

/**
 * Display CTR from basis points
 * 450 → "4.50%"
 */
export function formatCtr(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Calculate CPC in cents
 * spendCents: 1250, clicks: 45
 * result: 28 (= $0.28 per click)
 */
export function calculateCpcCents(
  spendCents: number,
  clicks: number
): number {
  if (clicks <= 0) return 0;
  return Math.round(spendCents / clicks);
}

/**
 * Calculate CAC in cents
 * spendCents: 15000, newCustomers: 10
 * result: 1500 (= $15.00 per customer)
 */
export function calculateCacCents(
  spendCents: number,
  newCustomers: number
): number {
  if (newCustomers <= 0) return 0;
  return Math.round(spendCents / newCustomers);
}

/**
 * Calculate AOV in cents
 * totalRevenueCents: 150000, orderCount: 50
 * result: 3000 (= $30.00 average order)
 */
export function calculateAovCents(
  totalRevenueCents: number,
  orderCount: number
): number {
  if (orderCount <= 0) return 0;
  return Math.round(totalRevenueCents / orderCount);
}

/**
 * Calculate CPM in cents (cost per 1000 impressions)
 * spendCents: 1250, impressions: 10000
 * result: 125 (= $1.25 per 1000 impressions)
 */
export function calculateCpmCents(
  spendCents: number,
  impressions: number
): number {
  if (impressions <= 0) return 0;
  return Math.round((spendCents * 1000) / impressions);
}

/**
 * Calculate percentage change between two periods
 * Returns basis points: 10% change = 1000 basis points
 * Use basis points to avoid float
 * 
 * current: 15000, previous: 12000
 * result: 2500 (= 25.00% increase)
 */
export function calculateChangeBasisPoints(
  current: number,
  previous: number
): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) * 10000) / previous);
}

/**
 * Display percentage change
 * 2500 → "+25.00%"
 * -500 → "-5.00%"
 */
export function formatChange(basisPoints: number): string {
  const sign = basisPoints >= 0 ? "+" : "";
  return `${sign}${(basisPoints / 100).toFixed(2)}%`;
}

/**
 * Safe integer addition — prevents NaN propagation
 * If any value is NaN/undefined, treats as 0
 */
export function safeAdd(...values: (number | null | undefined)[]): number {
  return values.reduce((sum: number, v) => {
    if (v === null || v === undefined || isNaN(v)) return sum;
    return sum + Math.round(v);
  }, 0);
}

/**
 * Validate that a cent value is reasonable
 * Catches bugs where float was accidentally passed
 */
export function validateCents(value: number, fieldName: string): number {
  if (!Number.isInteger(value)) {
    // If float sneaked in, round and log warning
    console.warn(`[money] ${fieldName} received float ${value}, rounding to ${Math.round(value)}`);
    return Math.round(value);
  }
  if (value < 0) {
    // Negative is allowed (refunds), but log if unexpected
    return value;
  }
  if (value > 1_000_000_000) {
    // $10 million+ order — suspicious, log it
    console.warn(`[money] ${fieldName} unusually large: ${value} cents`);
  }
  return value;
}