import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getDistributionStats,
  getDistributionStatsCount,
} from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const cryptos = sp.get("cryptos")?.split(",").filter(Boolean) || [];
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const windowDays = parseInt(sp.get("window") || "90");
  const limit = parseInt(sp.get("limit") || "50");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  const rows = await getDistributionStats(
    cryptos,
    from,
    to,
    windowDays,
    format === "csv" ? 0 : limit,
    format === "csv" ? 0 : offset,
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], [
      "symbol",
      "name",
      "date",
      "window_days",
      "skewness",
      "kurtosis",
      "num_observations",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="distribution_export.csv"',
      },
    });
  }

  const total = await getDistributionStatsCount(cryptos, from, to, windowDays);

  return NextResponse.json({ rows, total, limit, offset });
}
