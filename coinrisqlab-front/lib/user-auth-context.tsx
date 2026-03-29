"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { API_BASE_URL } from "@/config/constants";

import type { User } from "@/types/user";

interface UserAuthContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserAuthContext = createContext<UserAuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export const useUserAuth = () => useContext(UserAuthContext);

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserJsonRef = useRef<string>("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/auth/me`, {
        credentials: "include",
      });
      const json = await res.json();
      const newUser = json.data || null;
      const newUserJson = JSON.stringify(newUser);

      // Only update state if user data actually changed — avoids re-renders
      if (newUserJson !== lastUserJsonRef.current) {
        lastUserJsonRef.current = newUserJson;
        setUser(newUser);
      }
    } catch {
      if (lastUserJsonRef.current !== "null") {
        lastUserJsonRef.current = "null";
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/user/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    lastUserJsonRef.current = "null";
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();

    // Refresh on window focus to pick up plan changes
    const onFocus = () => refresh();

    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return (
    <UserAuthContext.Provider value={value}>
      {children}
    </UserAuthContext.Provider>
  );
}
