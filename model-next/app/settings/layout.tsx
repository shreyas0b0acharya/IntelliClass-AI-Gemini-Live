"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Navbar } from "@/components/navbar";
import { useAuth } from "@/lib/auth/AuthContext";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavUser } from "@/components/nav-user";
import { Loader2 } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, isLecturer, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!profile) {
        router.replace("/login?redirectTo=/settings");
      }
    }
  }, [isLoading, profile, router]);

  if (isLoading || !profile) {
    return (
      <div className="h-screen w-screen bg-white dark:bg-[#000000] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3] animate-spin">
          <Loader2 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#86868b] animate-pulse">
          Loading Profile &amp; Settings...
        </p>
      </div>
    );
  }

  // 1. Student View: Clean full-width layout with top Navbar (NO sidebar) and ample top clearance
  if (!isLecturer) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col">
        <Navbar showLinks={true} />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-8 pb-20 animate-in fade-in duration-200">
          {children}
        </main>
      </div>
    );
  }

  // 2. Lecturer View: Studio sidebar layout with sticky header and top clearance
  return (
    <div className="role-lecturer">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Sticky macOS Studio Header */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-black/80 px-5 sm:px-6 backdrop-blur-xl transition-colors duration-200">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4 mx-1.5 bg-black/10 dark:bg-white/10" />
              <span className="text-[13px] sm:text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                Profile &amp; Studio Settings
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <ThemeToggle />
              <NavUser />
            </div>
          </header>

          {/* Main Content Canvas with generous top clearance below sticky header */}
          <main className="flex-1 px-4 sm:px-6 md:px-8 pt-8 pb-20 max-w-5xl w-full mx-auto animate-in fade-in duration-200">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
