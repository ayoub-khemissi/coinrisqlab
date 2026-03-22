"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "cookie-consent";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function loadGTM() {
  if (!GTM_ID || document.getElementById("gtm-script")) return;

  const script = document.createElement("script");

  script.id = "gtm-script";
  script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`;
  document.head.appendChild(script);
}

function loadGA() {
  if (!GA_ID || document.getElementById("ga-script")) return;

  const script = document.createElement("script");

  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  const inline = document.createElement("script");

  inline.id = "ga-inline";
  inline.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`;
  document.head.appendChild(inline);
}

function loadAnalytics() {
  loadGTM();
  loadGA();
}

function removeAnalytics() {
  // Remove GTM scripts
  document.getElementById("gtm-script")?.remove();
  const sel = `script[src*="googletagmanager.com/gtm.js?id=${GTM_ID}"]`;

  document.querySelectorAll(sel).forEach((s) => s.remove());

  // Remove GA scripts
  document.getElementById("ga-script")?.remove();
  document.getElementById("ga-inline")?.remove();

  // Clear dataLayer
  if (window.dataLayer) {
    window.dataLayer.length = 0;
  }

  // Remove analytics cookies
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();

    if (
      name.startsWith("_ga") ||
      name.startsWith("_gid") ||
      name.startsWith("_gat")
    ) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);

    if (consent === "accepted") {
      loadAnalytics();
    } else if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = useCallback(() => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    loadAnalytics();
    setVisible(false);
  }, []);

  const refuse = useCallback(() => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "refused");
    removeAnalytics();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-content1 border-t border-default-200 shadow-lg">
      <div className="container mx-auto max-w-screen-2xl flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-default-600 flex-1">
          We use cookies to analyze site traffic and improve your experience.
          You can accept or decline analytics cookies. See our{" "}
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
