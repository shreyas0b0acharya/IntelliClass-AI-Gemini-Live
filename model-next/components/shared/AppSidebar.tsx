"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Sparkles,
  Presentation,
  FileText,
  Plus,
  Loader2,
  ChevronRight,
  Settings,
} from "lucide-react";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { Course } from "@/lib/supabase/types";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { CreateCourseDialog } from "@/features/courses";
import { Button } from "@/components/ui/button";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { user, isLecturer, isLoading: isAuthLoading } = useAuth();
  const isCollapsed = state === "collapsed";

  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    if (isAuthLoading || !user) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let active = true;

    const loadCourses = () => {
      api.getCourses()
        .then(({ courses: fetched }) => {
          if (active && fetched) setCourses(fetched);
        })
        .catch((err) => {
          if (err?.status !== 401) {
            console.error("Failed to load courses in sidebar:", err);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    loadCourses();

    const handleCoursesChanged = () => {
      loadCourses();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:courses-changed", handleCoursesChanged);
    }

    const channel = supabase
      .channel("sidebar:courses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courses" },
        () => {
          loadCourses();
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:courses-changed", handleCoursesChanged);
      }
      supabase.removeChannel(channel);
    };
  }, [user, isAuthLoading, refreshTrigger]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Brand Header */}
 <SidebarHeader className="">
        <Link
          href="/dashboard"
          onClick={handleLinkClick}
          className={`flex items-center gap-2.5 rounded-xl transition-colors ${isCollapsed ? "justify-center" : ""
            }`}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 bg-primary shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-foreground dark:text-foreground">
                IntelliClass AI
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Navigation Sections */}
 <SidebarContent className="">
        {/* ── 1. Workspace / Dashboard ─────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Dashboard Overview"
                  isActive={pathname === "/dashboard"}
                >
                  <Link href="/dashboard" onClick={handleLinkClick}>
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>Dashboard Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Account & Role Settings"
                  isActive={pathname === "/settings"}
                >
                  <Link href="/settings" onClick={handleLinkClick}>
                    <Settings className="h-4 w-4 shrink-0" />
                    <span>Account &amp; Role</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isLecturer && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="AI Avatar & Voice Studio"
                    isActive={pathname === "/settings/avatar"}
                  >
                    <Link href="/settings/avatar" onClick={handleLinkClick}>
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      <span>AI Avatar &amp; Voice</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── 2. Course Curriculum & Full Session Structure ────────────── */}
        <SidebarGroup>
          <div className="flex items-center justify-between px-2.5 mb-1">
 <SidebarGroupLabel className="">
              Course Spaces
            </SidebarGroupLabel>
            {isLecturer && !isCollapsed && (
              <CreateCourseDialog
                onCreated={() => setRefreshTrigger((prev) => prev + 1)}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Add Course Space"
 className="h-6 w-6 "
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            )}
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <div className="p-2.5 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {!isCollapsed && <span>Loading courses...</span>}
                </div>
              ) : courses.length === 0 ? (
                !isCollapsed && (
                  <div className="p-2.5 text-xs text-muted-foreground text-center">
                    <span>No active courses.</span>
                  </div>
                )
              ) : (
                courses.map((course) => {
                  const isCourseActive = pathname.startsWith(`/course/${course.id}`);
                  return (
                    <SidebarMenuItem key={course.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={course.title}
                        isActive={isCourseActive}
                      >
                        <Link href={`/course/${course.id}`} onClick={handleLinkClick}>
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <span className="truncate">{course.title}</span>
                          {!isCollapsed && isCourseActive && (
                            <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                          )}
                        </Link>
                      </SidebarMenuButton>

                      {/* Sub-tree structure for Course: Sessions & Materials */}
                      {!isCollapsed && isCourseActive && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === `/course/${course.id}`}>
                              <Link
                                href={`/course/${course.id}`}
                                onClick={handleLinkClick}
                                className="flex items-center gap-2"
                              >
                                <Presentation className="h-3.5 w-3.5" />
                                <span>Sessions &amp; Broadcasts</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.includes("tab=materials")}>
                              <Link
                                href={`/course/${course.id}?tab=materials`}
                                onClick={handleLinkClick}
                                className="flex items-center gap-2"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Materials</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
