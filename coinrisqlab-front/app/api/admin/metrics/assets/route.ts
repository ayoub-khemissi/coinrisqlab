import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getAssetMetrics } from "@/lib/queries/admin-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getAssetMetrics();

  return NextResponse.json({ data });
}
