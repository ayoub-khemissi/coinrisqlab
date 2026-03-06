"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "super_admin";
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  admin: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export const useAdminAuth = () => useContext(AdminAuthContext);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/me");
      const data = await res.json();

      setAdmin(data.admin || null);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAdmin(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, refresh, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
