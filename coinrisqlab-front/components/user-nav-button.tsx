"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { User } from "lucide-react";

/**
 * Simple navbar button — checks for user cookie existence only (no context dependency).
 * This avoids wrapping the entire app in UserAuthProvider which causes
 * re-renders that break the Binance WebSocket on the home page.
 */
export function UserNavButton() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check if the user session cookie exists
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("coinrisqlab_user_session="));

    setHasSession(hasCookie);
  }, []);

  if (hasSession) {
    return (
      <Button
        as={NextLink}
        href="/dashboard"
        isIconOnly
        radius="full"
        size="sm"
        variant="flat"
      >
        <User size={18} />
      </Button>
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
