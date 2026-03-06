"use client";

import NextLink from "next/link";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";

import { useAdminAuth } from "@/lib/admin-auth-context";

export function AdminHeader() {
  const router = useRouter();
  const { admin, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <header className="h-14 bg-[#0d1117] border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <NextLink
          className="flex justify-start items-center gap-2 group"
          href="/"
        >
          <span className="font-bold text-sm text-primary tracking-widest uppercase">
            CoinRisqLab
          </span>
        </NextLink>
      </div>
      <div className="flex items-center gap-4">
        {admin && (
          <span className="text-sm text-gray-400">
            {admin.display_name}
            <span className="text-xs text-gray-600 ml-2">({admin.role})</span>
          </span>
        )}
        <Button
          className="text-red-400 hover:text-red-300"
          size="sm"
          variant="light"
          onPress={handleLogout}
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
