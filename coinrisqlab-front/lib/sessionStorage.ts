/**
 * SessionStorage keys used throughout the application
 * Centralized to avoid typos and make it easier to manage
 */
export const SESSION_STORAGE_KEYS = {
  /**
   * Stores the return path when navigating from crypto table to crypto detail page
   */
  CRYPTO_RETURN_PATH: "cryptoReturnPath",
} as const;

/**
 * Type for sessionStorage keys
 */
export type SessionStorageKey = keyof typeof SESSION_STORAGE_KEYS;

/**
 * Type-safe sessionStorage helper functions
 */
export const sStorage = {
  /**
   * Get a value from sessionStorage
   */
  get: (key: SessionStorageKey): string | null => {
    if (typeof window === "undefined") return null;

    return sessionStorage.getItem(SESSION_STORAGE_KEYS[key]);
  },

  /**
   * Set a value in sessionStorage
   */
  set: (key: SessionStorageKey, value: string): void => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SESSION_STORAGE_KEYS[key], value);
  },

  /**
   * Remove a value from sessionStorage
   */
  remove: (key: SessionStorageKey): void => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SESSION_STORAGE_KEYS[key]);
  },

  /**
   * Clear all sessionStorage
   */
  clear: (): void => {
    if (typeof window === "undefined") return;
    sessionStorage.clear();
  },
};
