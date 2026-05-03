import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getOverviewMetrics } from "@/lib/queries/admin-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getOverviewMetrics();

  return NextResponse.json({ data });
}
