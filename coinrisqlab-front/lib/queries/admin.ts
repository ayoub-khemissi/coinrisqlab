import type { Admin } from "@/types/news";

import { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "@/lib/db";

export async function findAdminByUsername(
  username: string,
): Promise<Admin | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM admins WHERE username = ? AND is_active = 1",
    [username],
  );

  if (rows.length === 0) return null;

  return rows[0] as Admin;
}

export async function findAdminById(id: number): Promise<Admin | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM admins WHERE id = ? AND is_active = 1",
    [id],
  );

  if (rows.length === 0) return null;

  return rows[0] as Admin;
}

export async function updateAdminLastLogin(id: number): Promise<void> {
  await db.execute("UPDATE admins SET last_login = NOW() WHERE id = ?", [id]);
}

export async function createAuditLog(
  adminId: number,
  action: string,
  targetType: string,
  targetId: number | null,
  details: unknown,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    "INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)",
    [adminId, action, targetType, targetId, JSON.stringify(details)],
  );
}
