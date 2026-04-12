"use client";

import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";

interface Column {
  key: string;
  label: string;
}

interface DataTableProps {
  rows: Record<string, unknown>[];
  columns: Column[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 12 });
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const s = String(value);

  // Format date strings
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && s.length <= 10) return s;
  if (s.includes("T") && s.includes("Z"))
    return new Date(s).toISOString().split("T")[0];

  return s;
}

export function DataTable({
  rows,
  columns,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
}: DataTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-default-500">{total} results</p>
      <Table aria-label="Data table" removeWrapper>
        <TableHeader>
          {columns.map((col) => (
            <TableColumn key={col.key}>{col.label}</TableColumn>
          ))}
        </TableHeader>
        <TableBody emptyContent="No data found">
          {rows.map((row, idx) => (
            <TableRow key={idx}>
              {columns.map((col) => (
                <TableCell key={col.key} className="text-xs font-mono">
                  {formatCell(row[col.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            showControls
            page={page}
            total={totalPages}
            onChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
