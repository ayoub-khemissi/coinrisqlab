"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Skeleton } from "@heroui/skeleton";
import { Search, X } from "lucide-react";

import { CsvDownloadButton } from "@/components/admin/data-validation/csv-download-button";

interface User {
  id: number;
  email: string;
  display_name: string;
  plan: "free" | "pro";
  plan_expires_at: string | null;
  is_active: number;
  email_verified: number;
  last_login_at: string | null;
  created_at: string;
  portfolios_count: number;
  active_sessions: number;
}

const PAGE_SIZE = 50;

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

const initialFilters = {
  search: "",
  plan: "",
  emailVerified: "",
  isActive: "",
  createdFrom: "",
  createdTo: "",
  lastLoginFrom: "",
  lastLoginTo: "",
};

export default function AdminUsersPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};

    for (const [k, v] of Object.entries(appliedFilters)) {
      if (v) p[k] = v;
    }

    return p;
  }, [appliedFilters]);

  const fetchUsers = async (pageNum: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        ...queryParams,
        limit: String(PAGE_SIZE),
        offset: String((pageNum - 1) * PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/users?${query.toString()}`);
      const d = await res.json();

      setRows(d.rows || []);
      setTotal(d.total || 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount + whenever applied filters change
  useEffect(() => {
    setPage(1);
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters]);

  const handleSearch = () => setAppliedFilters({ ...filters });
  const handleReset = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };

  const updateFilter = (key: keyof typeof filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <span className="text-sm text-default-500">
          {total.toLocaleString("en-US")} matching user
          {total === 1 ? "" : "s"}
        </span>
      </div>

      <Card>
        <CardBody className="p-4 space-y-3">
          {/* Row 1: search + plan + verified + active */}
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              className="w-72"
              endContent={
                filters.search ? (
                  <button
                    aria-label="Clear search"
                    type="button"
                    onClick={() => updateFilter("search", "")}
                  >
                    <X className="text-default-400" size={14} />
                  </button>
                ) : null
              }
              label="Search (email or name)"
              placeholder="ahmed@…"
              size="sm"
              startContent={<Search className="text-default-400" size={14} />}
              value={filters.search}
              onValueChange={(v) => updateFilter("search", v)}
            />
            <Select
              className="w-32"
              label="Plan"
              selectedKeys={filters.plan ? [filters.plan] : []}
              size="sm"
              onSelectionChange={(keys) =>
                updateFilter("plan", String(Array.from(keys)[0] || ""))
              }
            >
              <SelectItem key="">All</SelectItem>
              <SelectItem key="free">Free</SelectItem>
              <SelectItem key="pro">Pro</SelectItem>
            </Select>
            <Select
              className="w-40"
              label="Email verified"
              selectedKeys={filters.emailVerified ? [filters.emailVerified] : []}
              size="sm"
              onSelectionChange={(keys) =>
                updateFilter("emailVerified", String(Array.from(keys)[0] || ""))
              }
            >
              <SelectItem key="">All</SelectItem>
              <SelectItem key="yes">Verified</SelectItem>
              <SelectItem key="no">Not verified</SelectItem>
            </Select>
            <Select
              className="w-32"
              label="Active"
              selectedKeys={filters.isActive ? [filters.isActive] : []}
              size="sm"
              onSelectionChange={(keys) =>
                updateFilter("isActive", String(Array.from(keys)[0] || ""))
              }
            >
              <SelectItem key="">All</SelectItem>
              <SelectItem key="yes">Active</SelectItem>
              <SelectItem key="no">Inactive</SelectItem>
            </Select>
          </div>

          {/* Row 2: signup + last login date ranges */}
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              className="w-44"
              label="Signup from"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={filters.createdFrom}
              onValueChange={(v) => updateFilter("createdFrom", v)}
            />
            <Input
              className="w-44"
              label="Signup to"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={filters.createdTo}
              onValueChange={(v) => updateFilter("createdTo", v)}
            />
            <Input
              className="w-44"
              label="Last login from"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={filters.lastLoginFrom}
              onValueChange={(v) => updateFilter("lastLoginFrom", v)}
            />
            <Input
              className="w-44"
              label="Last login to"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={filters.lastLoginTo}
              onValueChange={(v) => updateFilter("lastLoginTo", v)}
            />
          </div>

          {/* Row 3: actions */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              color="primary"
              isLoading={loading}
              size="sm"
              startContent={<Search size={16} />}
              onPress={handleSearch}
            >
              Search
            </Button>
            <Button size="sm" variant="flat" onPress={handleReset}>
              Reset
            </Button>
            <CsvDownloadButton
              endpoint="/api/admin/users"
              filename="users_export.csv"
              params={queryParams}
            />
          </div>
        </CardBody>
      </Card>

      {loading && rows.length === 0 ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table removeWrapper aria-label="Users table">
              <TableHeader>
                <TableColumn>ID</TableColumn>
                <TableColumn>Email</TableColumn>
                <TableColumn>Display name</TableColumn>
                <TableColumn>Plan</TableColumn>
                <TableColumn>Verified</TableColumn>
                <TableColumn>Active</TableColumn>
                <TableColumn>Portfolios</TableColumn>
                <TableColumn>Sessions</TableColumn>
                <TableColumn>Last login</TableColumn>
                <TableColumn>Signed up</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No users match your filters.">
                {rows.map((u) => (
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
                    <TableCell>
                      <Chip
                        color={u.is_active ? "success" : "danger"}
                        size="sm"
                        variant="flat"
                      >
                        {u.is_active ? "yes" : "no"}
                      </Chip>
                    </TableCell>
                    <TableCell>{u.portfolios_count}</TableCell>
                    <TableCell>{u.active_sessions}</TableCell>
                    <TableCell>{fmtDate(u.last_login_at)}</TableCell>
                    <TableCell>{fmtDate(u.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={totalPages}
            onChange={(p) => {
              setPage(p);
              fetchUsers(p);
            }}
          />
        </div>
      )}
    </div>
  );
}
