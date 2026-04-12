import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { searchCryptos } from "@/lib/queries/data-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();

  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const search = request.nextUrl.searchParams.get("search") || "";
  const cryptos = await searchCryptos(search);

  return NextResponse.json({ cryptos });
}
