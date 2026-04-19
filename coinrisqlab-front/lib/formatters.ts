/**
 * Format a number as USD currency
 * For very small numbers (< 0.01), use scientific notation with subscript
 */
export function formatUSD(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format crypto price with adaptive decimal places
 */
export function formatCryptoPrice(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  // Tiered max precision; min:2 keeps the currency convention (cents always
  // shown), max strips trailing zeros so the displayed value matches the
  // source precision (e.g. WBT $54.44 stays $54.44, not $54.4400).
  if (num >= 100) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (num >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  }

  // Below $1: 4+ leading zeros after the decimal → subscript notation
  // ($0.0₄1234 = 0.00001234). Otherwise show plain decimals capped at 6.
  let raw = num.toString();

  if (raw.includes("e")) {
    // Expand scientific notation without float64 noise (e.g. 6.1e-9 → "0.0000000061")
    const [mantissa, expStr] = raw.toLowerCase().split("e");
    const exp = parseInt(expStr, 10);
    const cleanMantissa = mantissa.replace(".", "");
    const decimalPosition = mantissa.includes(".")
      ? mantissa.indexOf(".")
      : mantissa.length;
    const totalShift = -exp - decimalPosition;

    raw = "0." + "0".repeat(Math.max(0, totalShift)) + cleanMantissa;
  }

  const match = raw.match(/^0\.(0*)(\d+)$/);

  if (!match) return `$${raw}`;

  const zeros = match[1];
  const significant = match[2];

  if (zeros.length >= 4) {
    const subscriptDigits = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
    const subscript = zeros.length
      .toString()
      .split("")
      .map((d) => subscriptDigits[parseInt(d)])
      .join("");
    const significantDigits = significant.substring(0, 4);

    return `$0.0${subscript}${significantDigits}`;
  }

  // 0-5 leading zeros: show real value, capped at 6 decimals total, padded to min 2.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
}

/**
 * Format a number with commas every 3 digits
 */
export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format circulating supply with symbol
 */
export function formatCirculatingSupply(
  supply: number | string,
  symbol: string,
): string {
  const num = typeof supply === "string" ? parseFloat(supply) : supply;
  const formatted = formatNumber(num);

  return `${formatted} ${symbol}`;
}

/**
 * Format percentage change
 */
export function formatPercentage(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
}

/**
 * Get color class based on percentage value
 */
export function getPercentageColor(
  value: number | string,
): "success" | "danger" | "default" {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (num > 0) return "success";
  if (num < 0) return "danger";

  return "default";
}

/**
 * Format large numbers with T (trillion) or B (billion) suffix
 */
export function formatCompactUSD(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (num >= 1_000_000_000_000) {
    return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }

  return formatUSD(num);
}
