"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Download } from "lucide-react";

interface CsvDownloadButtonProps {
  endpoint: string;
  params: Record<string, string>;
  filename: string;
}

export function CsvDownloadButton({
  endpoint,
  params,
  filename,
}: CsvDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ ...params, format: "csv" });
      const res = await fetch(`${endpoint}?${query.toString()}`);

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      color="success"
      isLoading={loading}
      size="sm"
      startContent={<Download size={16} />}
      variant="flat"
      onPress={handleDownload}
    >
      CSV
    </Button>
  );
}
