"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { cn } from "@heroui/theme";

interface SidebarMetricCardProps {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  chipLabel?: string;
  chipColor?: string;
  isActive: boolean;
  onClick: () => void;
  isLoading?: boolean;
}

export function SidebarMetricCard({
  label,
  icon,
  value,
  subValue,
  chipLabel,
  chipColor = "default",
  isActive,
  onClick,
  isLoading,
}: SidebarMetricCardProps) {
  return (
    <Card
      isPressable
      className={cn(
        "w-full transition-all duration-200 border-2",
        isActive
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-default-200 bg-content1",
      )}
      onPress={onClick}
    >
      <CardBody className="p-4 overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 text-default-500">
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </div>
          {chipLabel && (
            <Chip
              className="h-6 text-xs"
              color={
                [
                  "default",
                  "primary",
                  "secondary",
                  "success",
                  "warning",
                  "danger",
                ].includes(chipColor)
                  ? (chipColor as any)
                  : "default"
              }
              size="sm"
              style={
                ![
                  "default",
                  "primary",
                  "secondary",
                  "success",
                  "warning",
                  "danger",
                ].includes(chipColor)
                  ? {
                      backgroundColor: `${chipColor}33`,
                      color: chipColor,
                      border: "none",
                    }
                  : undefined
              }
              variant="flat"
            >
              {chipLabel}
            </Chip>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {isLoading ? (
            <div className="h-8 w-24 bg-default-200 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold truncate">{value ?? "N/A"}</div>
          )}

          {subValue && !isLoading && (
            <div className="text-sm text-default-400">{subValue}</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
