"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { XCircle } from "lucide-react";

export default function PricingCancelPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <Card className="max-w-md w-full p-4">
        <CardBody className="flex flex-col items-center text-center gap-4">
          <XCircle className="text-default-400" size={64} />
          <h1 className="text-2xl font-bold">Checkout Cancelled</h1>
          <p className="text-default-500">
            No worries! You can upgrade anytime.
          </p>
          <div className="flex gap-3">
            <Button as={NextLink} href="/dashboard/pricing" variant="flat">
              Back to Pricing
            </Button>
            <Button as={NextLink} color="primary" href="/dashboard">
              Dashboard
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
