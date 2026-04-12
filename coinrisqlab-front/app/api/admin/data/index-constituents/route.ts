import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getIndexConstituents } from "@/lib/queries/data-validation";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const date = sp.get("date") || new Date().toISOString().split("T")[0];
  const limit = parseInt(sp.get("limit") || "100");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  const rows = await getIndexConstituents(date, format === "csv" ? 0 : limit, format === "csv" ? 0 : offset);

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], ["rank_position", "symbol", "name", "price_usd", "circulating_supply", "weight_in_index"]);

    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="index_constituents_${date}.csv"` },
    });
  }

  return NextResponse.json({ rows, total: rows.length, limit, offset });
}
