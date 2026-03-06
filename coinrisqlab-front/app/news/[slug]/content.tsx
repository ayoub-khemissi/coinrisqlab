"use client";

import type { News } from "@/types/news";

import { useEffect, useState } from "react";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import NextLink from "next/link";

import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Props {
  slug: string;
}

export function NewsArticleContent({ slug }: Props) {
  const [article, setArticle] = useState<News | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`/api/news/${slug}`);
        const data = await res.json();

        setArticle(data.article || null);
      } catch {
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-default-400 mb-4">Article not found.</p>
        <Button
          as={NextLink}
          color="primary"
          href="/news"
          variant="flat"
        >
          Back to news
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <Button
        as={NextLink}
        className="mb-8"
        color="primary"
        href="/news"
        size="sm"
        variant="flat"
      >
        ← Back to news
      </Button>

      {article.image_url && (
        <div className="rounded-2xl overflow-hidden mb-8 border border-default-200">
          <img
            alt={article.title}
            className="w-full h-auto max-h-[400px] object-cover"
            src={article.image_url}
          />
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl font-bold mb-4">
        {article.title}
      </h1>

      <div className="flex items-center gap-3 text-sm text-default-400 mb-8">
        <span>By {article.author_name}</span>
        <span>·</span>
        <span>
          {new Date(article.published_at).toLocaleDateString("en-US")}
        </span>
      </div>

      <div className="rounded-2xl p-8 border border-default-200 bg-default-50">
        <MarkdownRenderer content={article.content} />
      </div>
    </div>
  );
}
