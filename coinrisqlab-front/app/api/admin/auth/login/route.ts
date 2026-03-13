import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import {
  createAdminSession,
  getAdminSessionCookieOptions,
} from "@/lib/admin-auth";
import { findAdminByUsername, updateAdminLastLogin } from "@/lib/queries/admin";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "missingCredentials" },
        { status: 400 },
      );
    }

    const admin = await findAdminByUsername(username);

    if (!admin) {
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 },
      );
    }

    const token = await createAdminSession({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    await updateAdminLastLogin(admin.id);

    const cookieStore = await cookies();

    cookieStore.set(getAdminSessionCookieOptions(token));

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
        role: admin.role,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Admin login error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
