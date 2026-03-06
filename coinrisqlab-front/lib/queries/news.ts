import type { NewsRow } from "@/types/news";

import { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "@/lib/db";

function toMySQLDatetime(iso: string): string {
  return iso.replace("T", " ").replace("Z", "").replace(/\.\d{3}$/, "");
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 280);
}

async function ensureUniqueSlug(slug: string): Promise<string> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT slug FROM news WHERE slug = ? OR slug LIKE ?",
    [slug, `${slug}-%`],
  );

  if (rows.length === 0) return slug;

  const existing = new Set(rows.map((r) => r.slug as string));
  let candidate = slug;
  let i = 2;

  while (existing.has(candidate)) {
    candidate = `${slug}-${i}`;
    i++;
  }

  return candidate;
}

export async function getLatestNews(limit: number = 5): Promise<NewsRow[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE is_active = 1 AND published_at <= NOW() ORDER BY published_at DESC LIMIT ?",
    [String(limit)],
  );

  return (rows as NewsRow[]).map(parseNewsRow);
}

export async function getNewsBySlug(slug: string): Promise<NewsRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM news WHERE slug = ? AND is_active = 1 AND published_at <= NOW()",
    [slug],
  );

  if (rows.length === 0) return null;

  return parseNewsRow(rows[0] as NewsRow);
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
  const slug = await ensureUniqueSlug(generateSlug(data.title));

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO news (title, slug, content, image_url, author_name, published_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      slug,
      data.content,
      data.image_url,
      data.author_name,
      toMySQLDatetime(data.published_at),
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

  // If title changes, regenerate slug
  if (data.title !== undefined) {
    const slug = await ensureUniqueSlug(generateSlug(data.title));

    fields.push("title = ?");
    params.push(data.title);
    fields.push("slug = ?");
    params.push(slug);
  }

  const fieldMap: Record<string, unknown> = {
    content: data.content,
    image_url: data.image_url,
    author_name: data.author_name,
    published_at: data.published_at
      ? toMySQLDatetime(data.published_at)
      : undefined,
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
