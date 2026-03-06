import { NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { findAdminById } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ admin: null });
    }

    const admin = await findAdminById(session.id);

    if (!admin) {
      return NextResponse.json({ admin: null });
    }

    return NextResponse.json({
      admin: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
        role: admin.role,
      },
    });
  } catch {
    return NextResponse.json({ admin: null });
  }
}
