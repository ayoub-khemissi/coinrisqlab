"use client";

import type { NewsRow } from "@/types/news";

import { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import NextLink from "next/link";

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/admin/news");
      const data = await res.json();

      setNews(data.news || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    fetchNews();
  };

  const getStatusChip = (article: NewsRow) => {
    if (!article.is_active) {
      return (
        <Chip className="bg-red-500/10 text-red-400" size="sm">
          Inactive
        </Chip>
      );
    }
    const now = new Date();
    const publishDate = new Date(article.published_at);

    if (publishDate > now) {
      return (
        <Chip className="bg-orange-500/10 text-orange-400" size="sm">
          Scheduled
        </Chip>
      );
    }

    return (
      <Chip className="bg-green-500/10 text-green-400" size="sm">
        Active
      </Chip>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">News Articles</h1>
        <Button
          as={NextLink}
          className="bg-primary text-white font-bold"
          href="/admin/news/new"
        >
          Add Article
        </Button>
      </div>

      <Table
        aria-label="News articles"
        classNames={{
          wrapper: "bg-[#161b22] border border-gray-800",
          th: "bg-[#0d1117] text-gray-500 border-b border-gray-800",
          td: "text-gray-300",
        }}
      >
        <TableHeader>
          <TableColumn>ID</TableColumn>
          <TableColumn>Title</TableColumn>
          <TableColumn>Author</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Published At</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {news.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="text-gray-500">#{article.id}</TableCell>
              <TableCell>
                <span className="text-gray-200">{article.title}</span>
              </TableCell>
              <TableCell>{article.author_name}</TableCell>
              <TableCell>{getStatusChip(article)}</TableCell>
              <TableCell className="text-gray-400 text-sm">
                {new Date(article.published_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    as={NextLink}
                    className="text-blue-400"
                    href={`/admin/news/${article.id}/edit`}
                    size="sm"
                    variant="light"
                  >
                    Edit
                  </Button>
                  <Button
                    className="text-red-400"
                    size="sm"
                    variant="light"
                    onPress={() => handleDelete(article.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
