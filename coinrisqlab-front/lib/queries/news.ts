import type { NewsRow } from "@/types/news";

import { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "@/lib/db";

export async function getLatestNews(limit: number = 5): Promise<NewsRow[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE is_active = 1 AND published_at <= NOW() ORDER BY published_at DESC LIMIT ?",
    [String(limit)],
  );

  return (rows as NewsRow[]).map(parseNewsRow);
}

export async function getNewsById(id: number): Promise<NewsRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE id = ? AND is_active = 1 AND published_at <= NOW()",
    [id],
  );

  if (rows.length === 0) return null;

  return parseNewsRow(rows[0] as NewsRow);
}

export async function getNewsPaginated(
  limit: number,
  offset: number,
): Promise<{ rows: NewsRow[]; total: number }> {
  const [countResult] = await db.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM news WHERE is_active = 1 AND published_at <= NOW()",
  );
  const total = (countResult[0] as { total: number }).total;

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE is_active = 1 AND published_at <= NOW() ORDER BY published_at DESC LIMIT ? OFFSET ?",
    [String(limit), String(offset)],
  );

  return { rows: (rows as NewsRow[]).map(parseNewsRow), total };
}

export async function getAllNewsAdmin(): Promise<NewsRow[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news ORDER BY created_at DESC",
  );

  return (rows as NewsRow[]).map(parseNewsRow);
}

export async function getNewsByIdAdmin(id: number): Promise<NewsRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE id = ?",
    [id],
  );

  if (rows.length === 0) return null;

  return parseNewsRow(rows[0] as NewsRow);
}

export async function createNews(data: {
  title: string;
  content: string;
  image_url: string | null;
  author_name: string;
  published_at: string;
  is_active: boolean;
}): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO news (title, content, image_url, author_name, published_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.content,
      data.image_url,
      data.author_name,
      data.published_at,
      data.is_active ? 1 : 0,
    ],
  );

  return result.insertId;
}

export async function updateNews(
  id: number,
  data: Partial<{
    title: string;
    content: string;
    image_url: string | null;
    author_name: string;
    published_at: string;
    is_active: boolean;
  }>,
): Promise<boolean> {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  const fieldMap: Record<string, unknown> = {
    title: data.title,
    content: data.content,
    image_url: data.image_url,
    author_name: data.author_name,
    published_at: data.published_at,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value as string | number | null);
    }
  }

  if (data.is_active !== undefined) {
    fields.push("is_active = ?");
    params.push(data.is_active ? 1 : 0);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE news SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );

  return result.affectedRows > 0;
}

export async function deleteNews(id: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM news WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

function parseNewsRow(row: NewsRow): NewsRow {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}
