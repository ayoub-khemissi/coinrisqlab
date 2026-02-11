/**
 * LocalStorage keys used throughout the application
 * Centralized to avoid typos and make it easier to manage
 */
export const LOCAL_STORAGE_KEYS = {
  /**
   * Stores whether the user has dismissed the "Limited Historical Data" warning
   * Value: "true" if dismissed
   */
  PORTFOLIO_RISK_WARNING_DISMISSED: "portfolioRiskWarningDismissed",
} as const;

/**
 * Type for localStorage keys
 */
export type LocalStorageKey = keyof typeof LOCAL_STORAGE_KEYS;

/**
 * Type-safe localStorage helper functions
 */
export const lStorage = {
  /**
   * Get a value from localStorage
   */
  get: (key: LocalStorageKey): string | null => {
    if (typeof window === "undefined") return null;

    return localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
  },

  /**
   * Set a value in localStorage
   */
  set: (key: LocalStorageKey, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCAL_STORAGE_KEYS[key], value);
  },

  /**
   * Remove a value from localStorage
   */
  remove: (key: LocalStorageKey): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(LOCAL_STORAGE_KEYS[key]);
  },

  /**
   * Clear all localStorage
   */
  clear: (): void => {
    if (typeof window === "undefined") return;
    localStorage.clear();
  },
};
