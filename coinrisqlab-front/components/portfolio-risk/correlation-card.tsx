"use client";

import { useState, useEffect, useMemo } from "react";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { ArrowLeftRight, HelpCircle } from "lucide-react";
import { Tooltip } from "@heroui/tooltip";
import clsx from "clsx";

import { useCorrelation } from "@/hooks/usePortfolioVolatility";
import { PortfolioVolatilityConstituent } from "@/types/volatility";

interface CorrelationCardProps {
  constituents: PortfolioVolatilityConstituent[];
}

export function CorrelationCard({ constituents }: CorrelationCardProps) {
  // Default to top 2 constituents by weight
  const topConstituents = useMemo(() => {
    return [...constituents].sort((a, b) => b.weight - a.weight).slice(0, 2);
  }, [constituents]);

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const [symbol1, setSymbol1] = useState<string>("");
  const [symbol2, setSymbol2] = useState<string>("");

  // Initialize with top 2 constituents when available
  useEffect(() => {
    if (topConstituents.length >= 2 && !symbol1 && !symbol2) {
      setSymbol1(topConstituents[0].symbol);
      setSymbol2(topConstituents[1].symbol);
    }
  }, [topConstituents, symbol1, symbol2]);

  const { data, isLoading, error } = useCorrelation(symbol1, symbol2, "90d");

  const correlation = data?.correlation ?? 0;

  // Determine correlation strength and color
  const correlationInfo = useMemo(() => {
    const absCorr = Math.abs(correlation);
    let strength = "Weak";
    let color = "default";
    let description = "Little to no relationship";

    if (absCorr > 0.7) {
      strength = "Strong";
      color = correlation > 0 ? "success" : "danger"; // Green for positive, Red for negative (inverse)
      description =
        correlation > 0
          ? "Prices tend to move in the same direction"
          : "Prices tend to move in opposite directions";
    } else if (absCorr > 0.3) {
      strength = "Moderate";
      color = correlation > 0 ? "warning" : "warning";
      description =
        correlation > 0
          ? "Some tendency to move together"
          : "Some tendency to move oppositely";
    }

    return { strength, color, description };
  }, [correlation]);

  // Format correlation for display
  const formattedCorrelation = correlation.toFixed(2);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="text-primary" size={20} />
          <h3 className="font-semibold">Correlation Analysis</h3>
        </div>
        <Tooltip
          content={
            <div className="px-1 py-2 max-w-xs">
              <div className="text-small font-bold">Correlation Analysis</div>
              <div className="text-tiny">
                Measures how two assets move in relation to each other. +1 means
                they move perfectly together, -1 means they move oppositely.
              </div>
            </div>
          }
          isOpen={isTooltipOpen}
        >
          <HelpCircle
            className="text-default-400 cursor-help"
            size={16}
            onClick={() => setIsTooltipOpen(!isTooltipOpen)}
            onMouseLeave={() => setIsTooltipOpen(false)}
            onMouseOver={() => setIsTooltipOpen(true)}
          />
        </Tooltip>
      </div>

      <div className="flex flex-col gap-4 flex-grow justify-between">
        <div className="flex gap-2 items-center">
          <Select
            aria-label="Select first asset"
            className="max-w-xs"
            defaultSelectedKeys={symbol1 ? [symbol1] : []}
            disabledKeys={symbol2 ? [symbol2] : []}
            placeholder="Select asset"
            selectedKeys={symbol1 ? [symbol1] : []}
            size="sm"
            onChange={(e) => setSymbol1(e.target.value)}
          >
            {constituents.map((c) => (
              <SelectItem key={c.symbol} textValue={c.symbol}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.symbol}</span>
                  <span className="text-tiny text-default-400 truncate max-w-[80px]">
                    {c.name}
                  </span>
                </div>
              </SelectItem>
            ))}
          </Select>

          <span className="text-default-400">vs</span>

          <Select
            aria-label="Select second asset"
            className="max-w-xs"
            defaultSelectedKeys={symbol2 ? [symbol2] : []}
            disabledKeys={symbol1 ? [symbol1] : []}
            placeholder="Select asset"
            selectedKeys={symbol2 ? [symbol2] : []}
            size="sm"
            onChange={(e) => setSymbol2(e.target.value)}
          >
            {constituents.map((c) => (
              <SelectItem key={c.symbol} textValue={c.symbol}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.symbol}</span>
                  <span className="text-tiny text-default-400 truncate max-w-[80px]">
                    {c.name}
                  </span>
                </div>
              </SelectItem>
            ))}
          </Select>
        </div>

        <div
          className={clsx(
            "flex flex-col items-center justify-center py-4 bg-default-50 rounded-lg border border-default-100 transition-opacity",
            {
              "opacity-60": isLoading && data,
            },
          )}
        >
          {isLoading && !data ? (
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-8 w-24 bg-default-200 rounded mb-2" />
              <div className="h-4 w-16 bg-default-200 rounded" />
            </div>
          ) : error ? (
            <div className="text-danger text-sm">Error loading data</div>
          ) : (
            <>
              <div
                className={clsx("text-4xl font-bold mb-1", {
                  "text-success-600": correlationInfo.color === "success",
                  "text-warning-500": correlationInfo.color === "warning",
                  "text-danger-500": correlationInfo.color === "danger",
                  "text-default-500": correlationInfo.color === "default",
                })}
              >
                {formattedCorrelation}
              </div>
              <Chip
                color={
                  correlationInfo.color as
                    | "success"
                    | "warning"
                    | "danger"
                    | "default"
                }
                size="sm"
                variant="flat"
              >
                {correlationInfo.strength} Correlation
              </Chip>
            </>
          )}
        </div>

        <p className="text-xs text-center text-default-500">
          {correlationInfo.description}
        </p>
      </div>
    </div>
  );
}
