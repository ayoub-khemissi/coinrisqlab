import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getUserMetrics } from "@/lib/queries/admin-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getUserMetrics();

  return NextResponse.json({ data });
}
