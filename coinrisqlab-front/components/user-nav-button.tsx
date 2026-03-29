"use client";

import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Chip } from "@heroui/chip";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, LayoutDashboard, Settings } from "lucide-react";

import { useUserAuth } from "@/lib/user-auth-context";

export function UserNavButton() {
  const { user, loading, logout } = useUserAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    return (
      <Button
        as={NextLink}
        color="primary"
        href="/login"
        size="sm"
        variant="flat"
      >
        Sign In
      </Button>
    );
  }

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button isIconOnly radius="full" size="sm" variant="flat">
          <User size={18} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="User menu">
        <DropdownItem
          key="profile"
          className="h-14 gap-2"
          isReadOnly
          textValue="profile"
        >
          <p className="font-semibold">{user.displayName || user.email}</p>
          <Chip color={user.plan === "pro" ? "warning" : "default"} size="sm" variant="flat">
            {user.plan === "pro" ? "Pro" : "Free"}
          </Chip>
        </DropdownItem>
        <DropdownItem
          key="dashboard"
          startContent={<LayoutDashboard size={16} />}
          onPress={() => router.push("/dashboard")}
        >
          Dashboard
        </DropdownItem>
        <DropdownItem
          key="settings"
          startContent={<Settings size={16} />}
          onPress={() => router.push("/dashboard/settings")}
        >
          Settings
        </DropdownItem>
        <DropdownItem
          key="logout"
          className="text-danger"
          color="danger"
          startContent={<LogOut size={16} />}
          onPress={async () => {
            await logout();
            router.push("/");
          }}
        >
          Logout
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
