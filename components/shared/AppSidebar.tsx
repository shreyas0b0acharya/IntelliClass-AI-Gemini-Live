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
  Users,
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
  const [navigatingKey, setNavigatingKey] = React.useState<string | null>(null);
  const [prevPathname, setPrevPathname] = React.useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setNavigatingKey(null);
  }

  const handleLinkClick = (key: string, href: string) => {
    if (pathname !== href) {
      setNavigatingKey(key);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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

    let channel: any = null;
    if (supabase?.channel) {
      try {
        channel = supabase
          .channel("sidebar:courses")
          ?.on(
            "postgres_changes",
            { event: "*", schema: "public", table: "courses" },
            () => {
              loadCourses();
            }
          )
          ?.subscribe();
      } catch (err) {
        console.warn("Failed to subscribe in AppSidebar:", err);
      }
    }

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:courses-changed", handleCoursesChanged);
      }
      if (channel && supabase?.removeChannel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user, isAuthLoading, refreshTrigger]);


  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Brand Header */}
      <SidebarHeader className="">
        <Link
          href="/dashboard"
          onClick={() => handleLinkClick("dash", "/dashboard")}
          className={`flex items-center gap-2.5 rounded-xl transition-colors ${isCollapsed ? "justify-center" : ""
            }`}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 bg-primary shadow-xs">
            {isCollapsed && navigatingKey === "dash" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-foreground dark:text-foreground">
                IntelliClass AI
              </span>
            </div>
          )}
          {!isCollapsed && navigatingKey === "dash" && (
            <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
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
                  <Link href="/dashboard" onClick={() => handleLinkClick("dashboard", "/dashboard")}>
                    {isCollapsed && navigatingKey === "dashboard" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                    )}
                    <span>Dashboard Overview</span>
                    {!isCollapsed && navigatingKey === "dashboard" && (
                      <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isLecturer && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Students & Groups Management"
                    isActive={pathname === "/students"}
                  >
                    <Link href="/students" onClick={() => handleLinkClick("students", "/students")}>
                      {isCollapsed && navigatingKey === "students" ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Users className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                      <span>Students &amp; Groups</span>
                      {!isCollapsed && navigatingKey === "students" && (
                        <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Account & Role Settings"
                  isActive={pathname === "/settings"}
                >
                  <Link href="/settings" onClick={() => handleLinkClick("settings", "/settings")}>
                    {isCollapsed && navigatingKey === "settings" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Settings className="h-4 w-4 shrink-0" />
                    )}
                    <span>Account &amp; Role</span>
                    {!isCollapsed && navigatingKey === "settings" && (
                      <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
                    )}
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
                    <Link href="/settings/avatar" onClick={() => handleLinkClick("avatar", "/settings/avatar")}>
                      {isCollapsed && navigatingKey === "avatar" ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span>AI Avatar &amp; Voice</span>
                      {!isCollapsed && navigatingKey === "avatar" && (
                        <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
                      )}
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
                  const isCourseNavigating = navigatingKey === `course-${course.id}`;
                  const isSessionsNavigating = navigatingKey === `sessions-${course.id}`;
                  const isMaterialsNavigating = navigatingKey === `materials-${course.id}`;

                  return (
                    <SidebarMenuItem key={course.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={course.title}
                        isActive={isCourseActive}
                        className={isCourseNavigating ? "bg-sidebar-accent/70 text-sidebar-accent-foreground" : ""}
                      >
                        <Link
                          href={`/course/${course.id}`}
                          onClick={() => handleLinkClick(`course-${course.id}`, `/course/${course.id}`)}
                        >
                          {isCollapsed && isCourseNavigating ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                          ) : (
                            <BookOpen className="h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">{course.title}</span>
                          {!isCollapsed && (
                            isCourseNavigating ? (
                              <Loader2 className="h-3.5 w-3.5 ml-auto animate-spin text-primary shrink-0" />
                            ) : isCourseActive ? (
                              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                            ) : null
                          )}
                        </Link>
                      </SidebarMenuButton>

                      {/* Sub-tree structure for Course: 5 Areas */}
                      {!isCollapsed && isCourseActive && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === `/course/${course.id}` && !pathname.includes("tab=")}>
                              <Link
                                href={`/course/${course.id}`}
                                onClick={() => handleLinkClick(`overview-${course.id}`, `/course/${course.id}`)}
                                className="flex items-center gap-2"
                              >
                                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                                <span>Overview</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.includes("tab=roadmaps")}>
                              <Link
                                href={`/course/${course.id}?tab=roadmaps`}
                                onClick={() => handleLinkClick(`roadmaps-${course.id}`, `/course/${course.id}?tab=roadmaps`)}
                                className="flex items-center gap-2"
                              >
                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-chart-4" />
                                <span>Roadmaps</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.includes("tab=materials")}>
                              <Link
                                href={`/course/${course.id}?tab=materials`}
                                onClick={() => handleLinkClick(`materials-${course.id}`, `/course/${course.id}?tab=materials`)}
                                className="flex items-center gap-2"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span>Materials</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.includes("tab=classes") || pathname.includes("tab=sessions")}>
                              <Link
                                href={`/course/${course.id}?tab=classes`}
                                onClick={() => handleLinkClick(`classes-${course.id}`, `/course/${course.id}?tab=classes`)}
                                className="flex items-center gap-2"
                              >
                                <Presentation className="h-3.5 w-3.5 shrink-0" />
                                <span>Classes &amp; History</span>
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
