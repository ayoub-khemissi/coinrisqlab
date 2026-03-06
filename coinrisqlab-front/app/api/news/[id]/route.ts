import { NextRequest, NextResponse } from "next/server";

import { getNewsById } from "@/lib/queries/news";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const item = await getNewsById(parseInt(id));

    if (!item) {
      return NextResponse.json({ error: "notFound" }, { status: 404 });
    }

    return NextResponse.json({
      article: {
        id: item.id,
        title: item.title,
        content: item.content,
        image_url: item.image_url,
        author_name: item.author_name,
        published_at: item.published_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
    });
  } catch {
    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
