import { NewsArticleContent } from "./content";

import { siteConfig } from "@/config/site";
import { getNewsBySlug } from "@/lib/queries/news";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    return { title: "News" };
  }

  const description = article.content
    .replace(/[#*`>\-\[\]()!]/g, "")
    .slice(0, 160);

  return {
    title: article.title,
    description,
    alternates: {
      canonical: `${siteConfig.siteUrl}/news/${article.slug}`,
    },
    openGraph: {
      title: `${article.title} | CoinRisqLab`,
      description,
      url: `${siteConfig.siteUrl}/news/${article.slug}`,
      type: "article",
      publishedTime: article.published_at,
      authors: [article.author_name],
      images: article.image_url
        ? [{ url: article.image_url, alt: article.title }]
        : undefined,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <NewsArticleContent slug={slug} />;
}
