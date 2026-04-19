"use client";

import { useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { CheckCircle } from "lucide-react";

import { useUserAuth } from "@/lib/user-auth-context";

export default function PricingSuccessPage() {
  const { refresh } = useUserAuth();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex items-center justify-center py-20">
      <Card className="max-w-md w-full p-4">
        <CardBody className="flex flex-col items-center text-center gap-4">
          <CheckCircle className="text-success" size={64} />
          <h1 className="text-2xl font-bold">Welcome to Pro!</h1>
          <p className="text-default-500">
            Your subscription is active. You now have access to all advanced
            risk analytics, unlimited portfolios, and more.
          </p>
          <Button as={NextLink} color="primary" href="/dashboard">
            Go to Dashboard
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
