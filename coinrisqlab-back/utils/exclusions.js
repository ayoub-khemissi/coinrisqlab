/**
 * Parse categories JSON string into a lowercase array
 * @param {string|Array|null} categories - JSON string or array from DB
 * @returns {string[]} Lowercase category names
 */
function parseCategories(categories) {
  if (!categories) return [];
  try {
    const parsed = typeof categories === 'string' ? JSON.parse(categories) : categories;
    return Array.isArray(parsed) ? parsed.map(c => c.toLowerCase()) : [];
  } catch {
    return [];
  }
}

/**
 * Check if a cryptocurrency is a stablecoin based on its categories
 */
export function isStablecoin(categories) {
  return parseCategories(categories).some(c => c.includes('stablecoin'));
}

/**
 * Check if a cryptocurrency is a wrapped token based on its categories
 */
export function isWrapped(categories) {
  return parseCategories(categories).some(c => c.includes('wrapped'));
}

/**
 * Check if a cryptocurrency is a staked token based on its categories
 */
export function isStaked(categories) {
  return parseCategories(categories).some(c => c.includes('staking') || c.includes('staked'));
}

/**
 * Check if a cryptocurrency should be excluded from the index based on categories
 *
 * @param {Object} crypto - Cryptocurrency object with categories
 * @param {string|Array|null} [crypto.categories] - Categories JSON from DB
 * @returns {boolean} True if the symbol should be excluded
 */
export function isExcluded(crypto) {
  return isStablecoin(crypto.categories) || isWrapped(crypto.categories) || isStaked(crypto.categories);
}

/**
 * Get exclusion reason for a cryptocurrency
 * @param {Object} crypto - Cryptocurrency object with categories
 * @returns {string|null} Exclusion reason or null if not excluded
 */
export function getExclusionReason(crypto) {
  const reasons = [];

  if (isStablecoin(crypto.categories)) reasons.push('Stablecoin');
  if (isWrapped(crypto.categories)) reasons.push('Wrapped Token');
  if (isStaked(crypto.categories)) reasons.push('Staked');

  return reasons.length > 0 ? reasons.join(', ') : null;
}
