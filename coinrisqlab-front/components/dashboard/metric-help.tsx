"use client";

import { Tooltip } from "@heroui/tooltip";
import { Info } from "lucide-react";

import { Math } from "@/components/math";

interface MetricHelpProps {
  title: string;
  description: string;
  /** LaTeX expression, rendered via KaTeX in the tooltip */
  formula?: string;
  window?: string;
  size?: number;
}

export function MetricHelp({
  title,
  description,
  formula,
  window,
  size = 14,
}: MetricHelpProps) {
  return (
    <Tooltip
      content={
        <div className="max-w-xs p-1">
          <p className="font-semibold text-sm mb-1">{title}</p>
          <p className="text-xs text-default-600 leading-relaxed">
            {description}
          </p>
          {formula && (
            <div className="mt-2 text-default-600 text-[13px]">
              <Math display>{formula}</Math>
            </div>
          )}
          {window && (
            <p className="text-[11px] text-default-400 mt-1">
              Window: {window}
            </p>
          )}
        </div>
      }
      placement="top"
    >
      <Info
        className="text-default-400 cursor-help inline-block align-middle ml-1"
        size={size}
      />
    </Tooltip>
  );
}
