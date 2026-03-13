"use client";

import type { NewsRow } from "@/types/news";

import { useState, useRef } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { DatePicker } from "@heroui/date-picker";
import {
  now,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from "@internationalized/date";
import Image from "next/image";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface NewsFormProps {
  article?: NewsRow;
  onSubmit: (data: Record<string, unknown>) => void;
  loading: boolean;
}

export function NewsForm({ article, onSubmit, loading }: NewsFormProps) {
  const [title, setTitle] = useState(article?.title || "");
  const [content, setContent] = useState(article?.content || "");
  const [authorName, setAuthorName] = useState(
    article?.author_name || "CoinRisqLab",
  );
  const [publishedAt, setPublishedAt] = useState(() => {
    if (article?.published_at) {
      return parseAbsoluteToLocal(new Date(article.published_at).toISOString());
    }

    return now(getLocalTimeZone());
  });
  const [isActive, setIsActive] = useState(article?.is_active !== false);
  const [imageUrl, setImageUrl] = useState(article?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.url) {
        setImageUrl(data.url);
      } else {
        alert(data.msg || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      content,
      author_name: authorName,
      published_at: publishedAt.toDate().toISOString(),
      is_active: isActive,
      image_url: imageUrl || null,
    });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Input
        isRequired
        classNames={{
          inputWrapper: "bg-[#161b22] border-gray-700",
          input: "text-gray-200",
        }}
        label="Title"
        value={title}
        variant="bordered"
        onValueChange={setTitle}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">
          Content (Markdown)
        </h3>
        <p className="text-xs text-gray-500">
          Supports full Markdown: ## headings, **bold**, *italic*, - lists,
          [links](url), images, and code blocks.
        </p>
        <div data-color-mode="dark">
          <MDEditor
            height={400}
            value={content}
            onChange={(val) => setContent(val || "")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          isRequired
          classNames={{
            inputWrapper: "bg-[#161b22] border-gray-700",
            input: "text-gray-200",
          }}
          label="Author"
          value={authorName}
          variant="bordered"
          onValueChange={setAuthorName}
        />
        <DatePicker
          classNames={{
            inputWrapper: "bg-[#161b22] border-gray-700",
            input: "text-gray-200",
          }}
          granularity="minute"
          label="Published At"
          value={publishedAt}
          variant="bordered"
          onChange={(val) => {
            if (val) setPublishedAt(val);
          }}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">Cover Image</h3>
        <p className="text-xs text-gray-500">
          Recommended: 1200x630px, JPEG/PNG/WebP, max 5 MB
        </p>
        <div className="flex gap-3 items-center">
          <input
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            type="file"
            onChange={handleUpload}
          />
          <Button
            color="primary"
            isLoading={uploading}
            size="sm"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
          >
            Upload Image
          </Button>
          {imageUrl && (
            <Button
              color="danger"
              size="sm"
              variant="light"
              onPress={() => setImageUrl("")}
            >
              Remove
            </Button>
          )}
        </div>
        <Input
          classNames={{
            inputWrapper: "bg-[#161b22] border-gray-700",
            input: "text-gray-200",
          }}
          label="Or paste image URL"
          value={imageUrl}
          variant="bordered"
          onValueChange={setImageUrl}
        />
        {imageUrl && (
          <div className="rounded-lg overflow-hidden border border-gray-700 max-w-xs">
            <Image
              unoptimized
              alt="Preview"
              className="w-full h-auto"
              height={200}
              src={imageUrl}
              width={320}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          classNames={{
            wrapper: "group-data-[selected=true]:bg-green-500 bg-gray-700",
          }}
          isSelected={isActive}
          onValueChange={setIsActive}
        />
        <span className="text-sm text-gray-300">
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <Button
        className="bg-primary text-white font-bold"
        isLoading={loading}
        type="submit"
      >
        Save
      </Button>
    </form>
  );
}
