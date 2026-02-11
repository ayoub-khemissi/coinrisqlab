"use client";

import { Button } from "@heroui/button";
import { BookOpen } from "lucide-react";
import Link from "next/link";

interface MethodologyLinkProps {
  section: string;
  label?: string;
  variant?: "compact" | "full";
}

/**
 * A reusable component to link to the methodology page with the correct anchor
 * @param section - The anchor ID in the methodology page (e.g., "var", "beta", "sml")
 * @param label - Optional custom label (defaults to "Methodology")
 * @param variant - "compact" for icon-only on mobile, "full" for always showing text
 */
export function MethodologyLink({
  section,
  label = "Methodology",
  variant = "compact",
}: MethodologyLinkProps) {
  const href = `/methodology/risk-metrics#${section}`;

  if (variant === "compact") {
    return (
      <Link href={href}>
        <Button
          className="min-w-0 gap-1 text-default-500 hover:text-primary"
          size="sm"
          startContent={<BookOpen size={14} />}
          variant="light"
        >
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </Link>
    );
  }

  return (
    <Link href={href}>
      <Button
        className="gap-2"
        color="primary"
        size="sm"
        startContent={<BookOpen size={16} />}
        variant="flat"
      >
        {label}
      </Button>
    </Link>
  );
}
