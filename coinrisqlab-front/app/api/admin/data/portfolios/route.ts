import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { listUserPortfolios } from "@/lib/queries/data-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const portfolios = await listUserPortfolios();

  return NextResponse.json({ portfolios });
}
