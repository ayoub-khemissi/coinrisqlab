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

  if (num >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (num >= 0.1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(num);
  }

  if (num >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(num);
  }

  const str = num.toFixed(20);
  const match = str.match(/^0\.(0+)([1-9]\d*)/);

  if (match) {
    const zeros = match[1];
    const significantPart = match[2];

    if (zeros.length >= 4) {
      const subscriptDigits = [
        "₀",
        "₁",
        "₂",
        "₃",
        "₄",
        "₅",
        "₆",
        "₇",
        "₈",
        "₉",
      ];
      const subscript = zeros.length
        .toString()
        .split("")
        .map((d) => subscriptDigits[parseInt(d)])
        .join("");
      const significantDigits = significantPart.substring(0, 4);

      return `$0.0${subscript}${significantDigits}`;
    } else {
      const fullNumber = "0." + zeros + significantPart;
      const significantDigits = significantPart.substring(0, 8);

      return (
        "$" +
        fullNumber.substring(0, 2 + zeros.length + significantDigits.length)
      );
    }
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
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
