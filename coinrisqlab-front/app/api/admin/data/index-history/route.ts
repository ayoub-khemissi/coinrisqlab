import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getIndexHistory,
  getIndexHistoryCount,
} from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const limit = parseInt(sp.get("limit") || "50");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  const rows = await getIndexHistory(
    from,
    to,
    format === "csv" ? 0 : limit,
    format === "csv" ? 0 : offset,
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], [
      "date",
      "index_level",
      "total_market_cap",
      "num_constituents",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="index_history_export.csv"',
      },
    });
  }

  const total = await getIndexHistoryCount(from, to);

  return NextResponse.json({ rows, total, limit, offset });
}
