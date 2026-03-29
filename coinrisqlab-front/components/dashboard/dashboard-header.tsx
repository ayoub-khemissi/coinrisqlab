"use client";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ExternalLink } from "lucide-react";

import { useUserAuth } from "@/lib/user-auth-context";
import { ThemeSwitch } from "@/components/theme-switch";

export function DashboardHeader() {
  const { user, logout } = useUserAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-default-200 bg-background shrink-0">
      <div className="flex items-center gap-3">
        <Link
          as={NextLink}
          className="text-sm text-default-500 flex items-center gap-1 hover:text-primary"
          href="/"
        >
          <ExternalLink size={14} />
          Main Site
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <ThemeSwitch />
        {user && (
          <>
            <span className="text-sm text-default-600 hidden sm:inline">
              {user.displayName || user.email}
            </span>
            <Chip
              color={user.plan === "pro" ? "warning" : "default"}
              size="sm"
              variant="flat"
            >
              {user.plan === "pro" ? "Pro" : "Free"}
            </Chip>
          </>
        )}
        <Button
          isIconOnly
          aria-label="Logout"
          size="sm"
          variant="light"
          onPress={handleLogout}
        >
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  );
}
