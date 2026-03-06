import { NextRequest, NextResponse } from "next/server";

import { verifyAdminSession } from "@/lib/admin-auth";
import { getNewsByIdAdmin, updateNews, deleteNews } from "@/lib/queries/news";
import { createAuditLog } from "@/lib/queries/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const article = await getNewsByIdAdmin(parseInt(id));

    if (!article) {
      return NextResponse.json({ error: "notFound" }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error("Admin news detail error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = parseInt(id);
    const body = await request.json();

    const existing = await getNewsByIdAdmin(articleId);

    if (!existing) {
      return NextResponse.json({ error: "notFound" }, { status: 404 });
    }

    const updated = await updateNews(articleId, body);

    await createAuditLog(session.id, "update_news", "news", articleId, {
      changes: body,
    });

    return NextResponse.json({ success: updated });
  } catch (error) {
    console.error("Admin news update error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAdminSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const articleId = parseInt(id);

    const deleted = await deleteNews(articleId);

    await createAuditLog(session.id, "delete_news", "news", articleId, null);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("Admin news delete error:", error);

    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
