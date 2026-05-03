// Money math primitives. ALL amounts are bigint cents internally — never
// floats, never numbers (precision loss above 2^53 cents = $90 trillion).
// Display strings are derived only at the UI edge.

export const SUPPORTED_CURRENCIES = ["USD"] as const;

const CENTS_PER_UNIT = 100n;

export function fromCentsToString(cents: bigint, currency = "USD"): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / CENTS_PER_UNIT;
  const fraction = abs % CENTS_PER_UNIT;
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${sign}${symbol}${whole}.${fraction.toString().padStart(2, "0")}`;
}

// Parses "12.34", "12", ".34", "$12.34", "1,234.56" into cents. Throws on
// malformed input. Negative values rejected — UI passes positive amounts and
// signs are derived from balance computation.
export function fromStringToCents(input: string): bigint {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === ".") {
    throw new Error(`Invalid money input: ${input}`);
  }
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const fractionPadded = (fraction + "00").slice(0, 2);
  const cents = BigInt(whole) * CENTS_PER_UNIT + BigInt(fractionPadded);
  if (cents <= 0n) throw new Error("Amount must be positive");
  return cents;
}

// Equal split with deterministic remainder allocation: first (amount % n)
// recipients get an extra cent each. Stable: same input → same output.
export function distributeEqual(amount: bigint, n: number): bigint[] {
  if (n <= 0) throw new Error("distributeEqual requires n > 0");
  const nb = BigInt(n);
  const base = amount / nb;
  const remainder = Number(amount % nb);
  return Array.from({ length: n }, (_, i) =>
    i < remainder ? base + 1n : base,
  );
}

// Weighted split: each user's portion is floor(amount * shares[i] / total).
// Remainder cents distributed by largest fractional remainder first (then by
// index for tiebreak).
export function distributeByShares(
  amount: bigint,
  shares: number[],
): bigint[] {
  if (shares.length === 0) throw new Error("distributeByShares requires shares");
  const total = shares.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("Total shares must be > 0");
  if (shares.some((s) => s < 0 || !Number.isFinite(s))) {
    throw new Error("Shares must be non-negative finite numbers");
  }
  const totalB = BigInt(total);
  const base: bigint[] = shares.map(
    (s) => (amount * BigInt(s)) / totalB,
  );
  const remainder = amount - base.reduce((a, b) => a + b, 0n);
  // Distribute remainder by largest fractional part of (amount * share / total).
  const fractionalRanking = shares
    .map((s, i) => ({
      i,
      // Numerator of the floored fraction: (amount * s) mod total.
      // Larger = larger fractional portion lost in floor.
      frac: (amount * BigInt(s)) % totalB,
    }))
    .sort((a, b) => {
      if (a.frac > b.frac) return -1;
      if (a.frac < b.frac) return 1;
      return a.i - b.i;
    });
  for (let k = 0n; k < remainder; k++) {
    const target = fractionalRanking[Number(k)];
    if (!target) break;
    base[target.i] = (base[target.i] ?? 0n) + 1n;
  }
  return base;
}

// Validates exact-mode input: caller-provided per-participant cents must
// sum to the expense amount. No mutation; just a check.
export function validateExact(amount: bigint, parts: bigint[]): boolean {
  if (parts.length === 0) return false;
  if (parts.some((c) => c < 0n)) return false;
  return parts.reduce((a, b) => a + b, 0n) === amount;
}
