import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import {
  getPortfolioAnalytics,
  getPortfolioAnalyticsCount,
} from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const portfolioId = parseInt(sp.get("portfolioId") || "0");
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const windowDays = parseInt(sp.get("window") || "90");
  const limit = parseInt(sp.get("limit") || "50");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  if (!portfolioId) {
    return NextResponse.json(
      { error: "portfolioId is required" },
      { status: 400 },
    );
  }

  const rows = await getPortfolioAnalytics(
    portfolioId,
    from,
    to,
    windowDays,
    format === "csv" ? 0 : limit,
    format === "csv" ? 0 : offset,
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], [
      "date",
      "window_days",
      "total_value_usd",
      "num_holdings",
      "data_points",
      "daily_volatility",
      "annualized_volatility",
      "diversification_benefit",
      "var_95",
      "var_99",
      "cvar_95",
      "cvar_99",
      "skewness",
      "kurtosis",
      "sharpe_ratio",
      "portfolio_beta_weighted",
      "beta_regression",
      "alpha_regression",
      "r_squared",
      "correlation_with_index",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="portfolio_analytics_export.csv"',
      },
    });
  }

  const total = await getPortfolioAnalyticsCount(
    portfolioId,
    from,
    to,
    windowDays,
  );

  return NextResponse.json({ rows, total, limit, offset });
}
