import { RowDataPacket } from "mysql2";

import { db } from "@/lib/db";

export interface UserFilters {
  search?: string; // matches email or display_name (LIKE %...%)
  plan?: "free" | "pro" | "";
  emailVerified?: "yes" | "no" | "";
  isActive?: "yes" | "no" | "";
  createdFrom?: string; // YYYY-MM-DD
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
}

function buildWhere(f: UserFilters): { sql: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (f.search && f.search.trim()) {
    clauses.push("(u.email LIKE CONCAT('%', ?, '%') OR u.display_name LIKE CONCAT('%', ?, '%'))");
    params.push(f.search.trim(), f.search.trim());
  }
  if (f.plan === "free" || f.plan === "pro") {
    clauses.push("u.plan = ?");
    params.push(f.plan);
  }
  if (f.emailVerified === "yes") clauses.push("u.email_verified = 1");
  else if (f.emailVerified === "no") clauses.push("u.email_verified = 0");

  if (f.isActive === "yes") clauses.push("u.is_active = 1");
  else if (f.isActive === "no") clauses.push("u.is_active = 0");

  if (f.createdFrom) {
    clauses.push("DATE(u.created_at) >= ?");
    params.push(f.createdFrom);
  }
  if (f.createdTo) {
    clauses.push("DATE(u.created_at) <= ?");
    params.push(f.createdTo);
  }
  if (f.lastLoginFrom) {
    clauses.push("DATE(u.last_login_at) >= ?");
    params.push(f.lastLoginFrom);
  }
  if (f.lastLoginTo) {
    clauses.push("DATE(u.last_login_at) <= ?");
    params.push(f.lastLoginTo);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function searchUsers(
  filters: UserFilters,
  limit: number,
  offset: number,
) {
  const { sql, params } = buildWhere(filters);
  const limitClause = limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : "";
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.display_name, u.plan, u.plan_expires_at,
            u.is_active, u.email_verified, u.last_login_at, u.created_at,
            u.updated_at,
            (SELECT COUNT(*) FROM user_portfolios up WHERE up.user_id = u.id) AS portfolios_count,
            (SELECT COUNT(*) FROM user_sessions us WHERE us.user_id = u.id AND us.expires_at > NOW()) AS active_sessions
     FROM users u
     ${sql}
     ORDER BY u.created_at DESC
     ${limitClause}`,
    params,
  );

  return rows;
}

export async function countUsers(filters: UserFilters) {
  const { sql, params } = buildWhere(filters);
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users u ${sql}`,
    params,
  );

  return Number(rows[0].total);
}
