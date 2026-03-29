"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { UserAuthProvider, useUserAuth } from "@/lib/user-auth-context";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUserAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-content1">
          {children}
        </main>
        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <DashboardSidebar mobile />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserAuthProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </UserAuthProvider>
  );
}
