"use client";

import type { News } from "@/types/news";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import NextLink from "next/link";

const PAGE_SIZE = 10;

export function NewsList() {
  const [news, setNews] = useState<News[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNews = async (offset: number, append: boolean) => {
    try {
      const res = await fetch(`/api/news?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();

      if (append) {
        setNews((prev) => [...prev, ...(data.news || [])]);
      } else {
        setNews(data.news || []);
      }
      setTotal(data.total || 0);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchNews(0, false);
      setLoading(false);
    };

    load();
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchNews(news.length, true);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <p className="text-center text-default-400 py-16">
        No news available yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {news.map((item) => (
        <NextLink
          key={item.id}
          className="block group"
          href={`/news/${item.slug}`}
        >
          <div className="rounded-2xl overflow-hidden border border-default-200 hover:border-primary/30 transition-colors bg-default-50">
            <div className="flex flex-col md:flex-row">
              {item.image_url && (
                <div
                  className="w-full md:w-64 h-48 md:h-auto bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url('${item.image_url}')` }}
                />
              )}
              <div className="p-6 flex-1">
                <h3 className="text-xl font-bold group-hover:opacity-80 transition-opacity mb-2">
                  {item.title}
                </h3>
                <div className="flex items-center gap-3 text-sm text-default-400 mb-3">
                  <span>By {item.author_name}</span>
                  <span>·</span>
                  <span>
                    {new Date(item.published_at).toLocaleDateString("en-US")}
                  </span>
                </div>
                <p className="text-default-500 text-sm line-clamp-3">
                  {item.content.replace(/[#*`>\-\[\]()!]/g, "").slice(0, 200)}
                  ...
                </p>
                <span className="inline-block mt-3 text-sm text-default-500 group-hover:text-foreground transition-colors">
                  Read more →
                </span>
              </div>
            </div>
          </div>
        </NextLink>
      ))}

      {news.length < total && (
        <div className="flex justify-center pt-4">
          <Button
            color="primary"
            isLoading={loadingMore}
            variant="bordered"
            onPress={handleLoadMore}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
