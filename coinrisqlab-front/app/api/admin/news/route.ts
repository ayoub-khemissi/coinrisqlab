import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getAllNewsAdmin, createNews } from "@/lib/queries/news";
import { createAuditLog } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const news = await getAllNewsAdmin();

    return NextResponse.json({ news });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Admin news fetch error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.title || !body.content || !body.author_name) {
      return NextResponse.json({ error: "missingFields" }, { status: 400 });
    }

    const articleId = await createNews({
      title: body.title,
      content: body.content,
      image_url: body.image_url || null,
      author_name: body.author_name,
      published_at: body.published_at || new Date().toISOString(),
      is_active: body.is_active !== false,
    });

    await createAuditLog(session.id, "create_news", "news", articleId, {
      title: body.title,
      author: body.author_name,
    });

    return NextResponse.json({ success: true, id: articleId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Admin news create error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
