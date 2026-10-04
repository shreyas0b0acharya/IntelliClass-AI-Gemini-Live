"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, ThemeToggle, NavUser, AssetSyncModal } from "@/components/shared";
import { useAuth } from "@/features/auth";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, isLecturer, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!profile) {
        router.replace("/login?redirectTo=/dashboard");
      } else if (!isLecturer) {
        router.replace("/");
      }
    }
  }, [isLoading, profile, isLecturer, router]);

  if (isLoading || !profile || !isLecturer) {
    return (
      <div className="h-screen w-screen bg-white dark:bg-[#000000] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3] animate-spin">
          <Loader2 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#86868b] animate-pulse">
          Connecting to Dashboard...
        </p>
      </div>
    );
  }

  return (
    <div data-role="lecturer">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Sticky macOS Studio Header */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#121212]/70 px-5 sm:px-6 backdrop-blur-md transition-colors duration-200">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4 mx-1.5 bg-black/10 dark:bg-white/10" />
              <span className="text-[13px] sm:text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                Dashboard Overview
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <ThemeToggle />
              <NavUser />
            </div>
          </header>

          {/* Main Content Canvas */}
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Post-Login Persistent Asset Sync Modal */}
      <AssetSyncModal />
    </div>
  );
}
