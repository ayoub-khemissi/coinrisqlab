import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { searchUsers, countUsers, type UserFilters } from "@/lib/queries/admin-users";
import { toCsv } from "@/lib/csv-export";

export const dynamic = "force-dynamic";

function parseFilters(sp: URLSearchParams): UserFilters {
  const planParam = sp.get("plan");
  const verifiedParam = sp.get("emailVerified");
  const activeParam = sp.get("isActive");

  return {
    search: sp.get("search") || "",
    plan: planParam === "free" || planParam === "pro" ? planParam : "",
    emailVerified:
      verifiedParam === "yes" || verifiedParam === "no" ? verifiedParam : "",
    isActive:
      activeParam === "yes" || activeParam === "no" ? activeParam : "",
    createdFrom: sp.get("createdFrom") || "",
    createdTo: sp.get("createdTo") || "",
    lastLoginFrom: sp.get("lastLoginFrom") || "",
    lastLoginTo: sp.get("lastLoginTo") || "",
  };
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const filters = parseFilters(sp);
  const limit = parseInt(sp.get("limit") || "50");
  const offset = parseInt(sp.get("offset") || "0");
  const format = sp.get("format");

  const rows = await searchUsers(
    filters,
    format === "csv" ? 0 : limit,
    format === "csv" ? 0 : offset,
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[], [
      "id",
      "email",
      "display_name",
      "plan",
      "plan_expires_at",
      "is_active",
      "email_verified",
      "last_login_at",
      "created_at",
      "updated_at",
      "portfolios_count",
      "active_sessions",
    ]);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="users_export.csv"',
      },
    });
  }

  const total = await countUsers(filters);

  return NextResponse.json({ rows, total, limit, offset });
}
