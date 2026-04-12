import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getCorrelationReturns } from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;

  if (n < 2) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;

    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);

  return denom > 0 ? cov / denom : 0;
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const crypto1 = sp.get("crypto1") || "";
  const crypto2 = sp.get("crypto2") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const format = sp.get("format");

  if (!crypto1 || !crypto2) {
    return NextResponse.json({ error: "crypto1 and crypto2 are required" }, { status: 400 });
  }

  const { rows, symbols } = await getCorrelationReturns(crypto1, crypto2, from, to);

  const r1 = rows.map((r: Record<string, unknown>) => Number(r.return_1));
  const r2 = rows.map((r: Record<string, unknown>) => Number(r.return_2));
  const correlation = pearsonCorrelation(r1, r2);

  if (format === "csv") {
    const csvRows = rows.map((r: Record<string, unknown>) => ({
      date: r.date,
      [`${symbols[0]}_return`]: r.return_1,
      [`${symbols[1]}_return`]: r.return_2,
    }));
    const csv = toCsv(csvRows, ["date", `${symbols[0]}_return`, `${symbols[1]}_return`]);

    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="correlation_export.csv"' },
    });
  }

  return NextResponse.json({
    correlation: Number(correlation.toFixed(6)),
    symbols,
    dataPoints: rows.length,
    rows: rows.slice(0, 50), // preview limited
  });
}
