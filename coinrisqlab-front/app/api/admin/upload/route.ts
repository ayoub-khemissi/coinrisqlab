import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

import { verifyAdminSession } from "@/lib/admin-auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "noFile" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "invalidType",
          msg: "Accepted formats: JPEG, PNG, WebP",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: "tooLarge",
          msg: "Maximum file size: 5 MB",
        },
        { status: 400 },
      );
    }

    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "news");
    const filePath = path.join(uploadDir, filename);

    const bytes = new Uint8Array(await file.arrayBuffer());

    await writeFile(filePath, bytes);

    const url = `/uploads/news/${filename}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
