import { NextRequest, NextResponse } from "next/server";

import { getLatestNews, getNewsPaginated } from "@/lib/queries/news";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");
    const offsetParam = searchParams.get("offset");

    if (offsetParam !== null) {
      const offset = parseInt(offsetParam);
      const result = await getNewsPaginated(limit, offset);

      const news = result.rows.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        content: item.content,
        image_url: item.image_url,
        author_name: item.author_name,
        published_at: item.published_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      return NextResponse.json({ news, total: result.total });
    }

    const rows = await getLatestNews(limit);

    const news = rows.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      image_url: item.image_url,
      author_name: item.author_name,
      published_at: item.published_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return NextResponse.json(news);
  } catch (error) {
    console.error("News fetch error:", error);

    return NextResponse.json([], { status: 200 });
  }
}
