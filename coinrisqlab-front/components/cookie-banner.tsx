"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);

    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const refuse = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "refused");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-content1 border-t border-default-200 shadow-lg">
      <div className="container mx-auto max-w-screen-2xl flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-default-600 flex-1">
          This website only uses technical cookies necessary for its proper
          functioning. No advertising trackers are used. See our{" "}
          <Link className="text-primary hover:underline" href="/privacy-policy">
            privacy policy
          </Link>{" "}
          for more information.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="flat" onPress={refuse}>
            Decline
          </Button>
          <Button color="primary" size="sm" onPress={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
