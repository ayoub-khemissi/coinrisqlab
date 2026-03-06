export interface NewsRow {
  id: number;
  title: string;
  slug: string;
  content: string;
  image_url: string | null;
  author_name: string;
  published_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface News {
  id: number;
  title: string;
  slug: string;
  content: string;
  image_url: string | null;
  author_name: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdminJWTPayload {
  id: number;
  username: string;
  role: "admin" | "super_admin";
}

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: "admin" | "super_admin";
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}
