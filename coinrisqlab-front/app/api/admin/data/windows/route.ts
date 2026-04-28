import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getMetricWindows } from "@/lib/queries/data-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const metric = request.nextUrl.searchParams.get("metric") || "";
  const result = await getMetricWindows(metric);

  if (!result)
    return NextResponse.json({ error: "unknown metric" }, { status: 400 });

  return NextResponse.json(result);
}
