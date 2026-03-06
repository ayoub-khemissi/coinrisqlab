import { NewsArticleContent } from "./content";

import { getNewsById } from "@/lib/queries/news";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getNewsById(parseInt(id));

  if (!article) {
    return { title: "News" };
  }

  return {
    title: article.title,
    description: article.content.replace(/[#*`>\-\[\]()!]/g, "").slice(0, 160),
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <NewsArticleContent id={id} />;
}
