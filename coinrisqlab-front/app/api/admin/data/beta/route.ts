import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getBetaAlpha, getBetaAlphaCount } from "@/lib/queries/data-validation";
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
  const windowDays = parseInt(sp.get("window") || "365");
  const returnTypeParam = sp.get("returnType");
  const returnType: "log" | "simple" =
    returnTypeParam === "simple" ? "simple" : "log";
  const limit = parseInt(sp.get("limit") || "50");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  const rows = await getBetaAlpha(
    cryptos,
    from,
    to,
    windowDays,
    returnType,
    format === "csv" ? 0 : limit,
    format === "csv" ? 0 : offset,
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], [
      "symbol",
      "name",
      "date",
      "window_days",
      "return_type",
      "beta",
      "alpha",
      "r_squared",
      "correlation",
      "num_observations",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="beta_export.csv"',
      },
    });
  }

  const total = await getBetaAlphaCount(cryptos, from, to, windowDays, returnType);

  return NextResponse.json({ rows, total, limit, offset });
}
