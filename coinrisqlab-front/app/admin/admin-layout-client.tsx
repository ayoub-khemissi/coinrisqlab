"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname.endsWith("/admin/login");

  useEffect(() => {
    if (!loading && !admin && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [admin, loading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6 bg-content1">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
