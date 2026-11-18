"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, ThemeToggle, NavUser, GlobalSearchDialog } from "@/components/shared";
import { useAuth } from "@/features/auth";
import { useIsMounted } from "@/hooks/useIsMounted";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hasMounted = useIsMounted();
  const { profile, isLecturer, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!profile) {
        router.replace("/login");
      } else if (!isLecturer) {
        router.replace("/");
      }
    }
  }, [isLoading, profile, isLecturer, router]);

  if (!hasMounted || isLoading || !profile || !isLecturer) {
    return (
      <div className="h-screen w-screen bg-white dark:bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary animate-spin">
          <Loader2 className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground animate-pulse">
          Loading Course Space...
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
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-background/70 px-5 sm:px-6 backdrop-blur-md transition-colors duration-200">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4 mx-1.5" />
              <span className="text-sm sm:text-sm font-semibold text-foreground dark:text-foreground tracking-tight">
                Course Space
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <GlobalSearchDialog />
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
    </div>
  );
}
