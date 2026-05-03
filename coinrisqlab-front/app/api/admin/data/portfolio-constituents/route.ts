import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getPortfolioConstituents } from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const portfolioId = parseInt(sp.get("portfolioId") || "0");
  const format = sp.get("format");

  if (!portfolioId) {
    return NextResponse.json(
      { error: "portfolioId is required" },
      { status: 400 },
    );
  }

  const rows = await getPortfolioConstituents(portfolioId);

  if (format === "csv") {
    const csv = toCsv(rows as unknown as Record<string, unknown>[], [
      "symbol",
      "name",
      "quantity",
      "avg_buy_price_usd",
      "current_price_usd",
      "current_value_usd",
      "pnl_usd",
      "pnl_pct",
      "allocation_pct",
      "first_buy_date",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="portfolio_${portfolioId}_constituents.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, total: rows.length, limit: 0, offset: 0 });
}
