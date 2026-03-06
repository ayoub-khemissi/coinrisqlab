import { NextRequest, NextResponse } from "next/server";

import { getNewsBySlug } from "@/lib/queries/news";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const item = await getNewsBySlug(slug);

    if (!item) {
      return NextResponse.json({ error: "notFound" }, { status: 404 });
    }

    return NextResponse.json({
      article: {
        id: item.id,
        title: item.title,
        slug: item.slug,
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
