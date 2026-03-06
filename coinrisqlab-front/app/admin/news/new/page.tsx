"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { NewsForm } from "@/components/admin/news-form";

export default function AdminNewsNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/admin/news");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Add Article</h1>
      <NewsForm loading={loading} onSubmit={handleSubmit} />
    </div>
  );
}
