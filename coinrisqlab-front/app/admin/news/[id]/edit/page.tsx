"use client";

import type { NewsRow } from "@/types/news";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { NewsForm } from "@/components/admin/news-form";

export default function AdminNewsEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [article, setArticle] = useState<NewsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`/api/admin/news/${id}`);
        const data = await res.json();

        setArticle(data.article || null);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/admin/news");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!article) {
    return <p className="text-gray-400 text-center py-16">Article not found</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100 mb-6">
        Edit Article — {article.title}
      </h1>
      <NewsForm article={article} loading={saving} onSubmit={handleSubmit} />
    </div>
  );
}
