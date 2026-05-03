import { Card, CardBody } from "@heroui/card";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

const TONE_CLASS: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function KpiCard({ label, value, hint, tone = "default" }: KpiCardProps) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-xs uppercase tracking-wide text-default-500 mb-1">
          {label}
        </p>
        <p className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{value}</p>
        {hint && <p className="text-xs text-default-400 mt-1">{hint}</p>}
      </CardBody>
    </Card>
  );
}
