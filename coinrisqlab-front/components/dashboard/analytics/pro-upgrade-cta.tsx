"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { Lock } from "lucide-react";

interface ProUpgradeCtaProps {
  feature: string;
  description: string;
}

export function ProUpgradeCta({ feature, description }: ProUpgradeCtaProps) {
  return (
    <Card className="border border-warning/30 bg-warning/5">
      <CardBody className="flex flex-col items-center text-center py-8 gap-3">
        <Lock className="text-warning" size={32} />
        <h3 className="text-lg font-semibold">{feature}</h3>
        <p className="text-sm text-default-500 max-w-md">{description}</p>
        <Button
          as={NextLink}
          color="warning"
          href="/dashboard/pricing"
          size="sm"
          variant="flat"
        >
          Upgrade to Pro
        </Button>
      </CardBody>
    </Card>
  );
}
