"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@heroui/button";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@heroui/dropdown";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";

interface NavUser {
  displayName: string;
  email: string;
  plan: "free" | "pro";
}

export function UserNavButton() {
  const [hasSession, setHasSession] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Cookie is httpOnly so we can't check document.cookie — call the API directly
    fetch(`${API_BASE_URL}/user/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setHasSession(true);
          setUser({
            displayName: data.data.displayName,
            email: data.data.email,
            plan: data.data.plan,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/user/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setHasSession(false);
    setUser(null);
    router.push("/");
  }, [router]);

  if (hasSession) {
    const initials = user?.displayName
      ? user.displayName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "U";

    return (
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Avatar
            as="button"
            className="transition-transform"
            color="primary"
            name={initials}
            size="sm"
          />
        </DropdownTrigger>
        <DropdownMenu aria-label="User menu" variant="flat">
          <DropdownSection showDivider>
            <DropdownItem
              key="profile"
              isReadOnly
              className="h-14 gap-2"
              textValue="User info"
            >
              <p className="font-semibold">{user?.displayName || "User"}</p>
              <p className="text-xs text-default-500">{user?.email || ""}</p>
            </DropdownItem>
          </DropdownSection>
          <DropdownSection showDivider>
            <DropdownItem
              key="dashboard"
              as={NextLink}
              href="/dashboard"
              startContent={<LayoutDashboard size={16} />}
            >
              Dashboard
            </DropdownItem>
            <DropdownItem
              key="portfolios"
              as={NextLink}
              href="/dashboard/portfolios"
              startContent={<Briefcase size={16} />}
            >
              Portfolios
            </DropdownItem>
            <DropdownItem
              key="alerts"
              as={NextLink}
              href="/dashboard/alerts"
              startContent={<Bell size={16} />}
            >
              Alerts
            </DropdownItem>
            <DropdownItem
              key="settings"
              as={NextLink}
              href="/dashboard/settings"
              startContent={<Settings size={16} />}
            >
              Settings
            </DropdownItem>
            <DropdownItem
              key="pricing"
              as={NextLink}
              href="/dashboard/pricing"
              startContent={<CreditCard size={16} />}
            >
              Pricing
            </DropdownItem>
          </DropdownSection>
          <DropdownSection>
            <DropdownItem
              key="logout"
              className="text-danger"
              color="danger"
              startContent={<LogOut size={16} />}
              onPress={handleLogout}
            >
              Log Out
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
    );
  }

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
