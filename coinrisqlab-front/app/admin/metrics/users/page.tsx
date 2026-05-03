"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
import { Chip } from "@heroui/chip";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";

import { KpiCard } from "@/components/admin/metrics/kpi-card";

interface UsersData {
  totals: Record<string, number>;
  activeSessions: number;
  signupsByDay: Array<{ date: string; n: number }>;
  recent: Array<{
    id: number;
    email: string;
    display_name: string;
    plan: string;
    is_active: number;
    email_verified: number;
    last_login_at: string | null;
    created_at: string;
  }>;
}

const fmtN = (n: number | undefined) =>
  n != null ? Number(n).toLocaleString("en-US") : "—";
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";

export default function MetricsUsersPage() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics/users")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Metrics — Users</h1>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!data) return <p>Failed to load.</p>;

  const t = data.totals;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Metrics — Users</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Plan &amp; Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total users" value={fmtN(t.total)} />
          <KpiCard label="Pro" value={fmtN(t.pro)} tone="primary" />
          <KpiCard label="Free" value={fmtN(t.free)} />
          <KpiCard
            label="Active sessions"
            value={fmtN(data.activeSessions)}
            hint="Currently valid"
          />
          <KpiCard label="Email verified" value={fmtN(t.verified)} />
          <KpiCard
            label="Account active flag"
            value={fmtN(t.active)}
            hint="is_active=1"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          New signups
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="Last 24h" value={fmtN(t.new_24h)} tone="success" />
          <KpiCard label="Last 7d" value={fmtN(t.new_7d)} tone="success" />
          <KpiCard label="Last 30d" value={fmtN(t.new_30d)} tone="success" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Active users (logged in)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard label="Last 24h" value={fmtN(t.active_24h)} />
          <KpiCard label="Last 7d" value={fmtN(t.active_7d)} />
          <KpiCard label="Last 30d" value={fmtN(t.active_30d)} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Recent users (last 20)</h3>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Recent users">
            <TableHeader>
              <TableColumn>ID</TableColumn>
              <TableColumn>Email</TableColumn>
              <TableColumn>Display name</TableColumn>
              <TableColumn>Plan</TableColumn>
              <TableColumn>Verified</TableColumn>
              <TableColumn>Last login</TableColumn>
              <TableColumn>Signed up</TableColumn>
            </TableHeader>
            <TableBody>
              {data.recent.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.display_name || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      color={u.plan === "pro" ? "primary" : "default"}
                      size="sm"
                      variant="flat"
                    >
                      {u.plan}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={u.email_verified ? "success" : "warning"}
                      size="sm"
                      variant="flat"
                    >
                      {u.email_verified ? "yes" : "no"}
                    </Chip>
                  </TableCell>
                  <TableCell>{fmtDate(u.last_login_at)}</TableCell>
                  <TableCell>{fmtDate(u.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
