"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { Course, ClassroomSession } from "@/lib/supabase/types";
import { CreateCourseDialog } from "@/features/courses";
import { SessionCodeInput, StatusBadge } from "@/components/shared";
import { AppButton } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Presentation,
  Radio,
  Plus,
  Play,
  Pause,
  Clock,
  ArrowRight,
  BookOpen,
  FolderOpen,
} from "lucide-react";

export default function DashboardPage() {
  const { profile, isLecturer, isLoading: isAuthLoading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<
    (ClassroomSession & { courseTitle?: string })[]
  >([]);
  const [recentSessions, setRecentSessions] = useState<
    (ClassroomSession & { courseTitle?: string })[]
  >([]);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { courses: fetchedCourses } = await api.getCourses();
      if (!fetchedCourses) return;
      setCourses(fetchedCourses);

      const allSessions: (ClassroomSession & { courseTitle?: string })[] = [];

      await Promise.all(
        fetchedCourses.map(async (course) => {
          try {
            const sessRes = await api
              .getCourseSessions(course.id)
              .catch(() => ({ sessions: [] }));
            if (sessRes.sessions) {
              sessRes.sessions.forEach((s) => {
                allSessions.push({ ...s, courseTitle: course.title });
              });
            }
          } catch {}
        })
      );

      // Sort by newest
      allSessions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Filter: Live/Paused at the Top, recents below (excluding deleted)
      const liveOrPaused = allSessions.filter(
        (s) => (s.status as string) === "running" || (s.status as string) === "paused"
      );
      const others = allSessions.filter(
        (s) =>
          (s.status as string) !== "running" &&
          (s.status as string) !== "paused" &&
          (s.status as string) !== "deleted"
      );

      setActiveSessions(liveOrPaused);
      setRecentSessions(others.slice(0, 12));
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen to local window event triggered on course creation/deletion
    const handleCoursesChanged = () => {
      loadData();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:courses-changed", handleCoursesChanged);
    }

    // Subscribe to database realtime changes for courses & sessions
    const coursesChannel = supabase
      .channel("dashboard:courses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courses" },
        () => {
          loadData();
        }
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel("dashboard:sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:courses-changed", handleCoursesChanged);
      }
      supabase.removeChannel(coursesChannel);
      supabase.removeChannel(sessionsChannel);
    };
  }, [loadData]);

  if (isAuthLoading && !profile) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-10 w-64 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-60 rounded-2xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ── 1. Minimal Top Bar: Greeting + Quick Session Code + Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/10">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            Welcome back, {profile?.name || "Professor"}
          </h1>
          <p className="text-xs text-[#86868b]">
            Live lecture broadcasts, course spaces, and recent classroom sessions.
          </p>
        </div>

        {/* Quick Session Code Input + Action Buttons in Top */}
        <div className="flex flex-wrap items-center gap-3">
          <SessionCodeInput size="default" placeholder="Enter session code..." />

          {isLecturer && (
            <CreateCourseDialog
              onCreated={loadData}
              trigger={
                <AppButton
                  variant="primary"
                  shape="pill"
                  size="sm"
                  className="px-4 h-10 font-medium text-xs shadow-xs"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  <span>New Course</span>
                </AppButton>
              }
            />
          )}
        </div>
      </div>

      {/* ── 2. Live & Paused Broadcasts (TOP PRIORITY) ────────────────── */}
      {activeSessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Live &amp; Paused Broadcasts ({activeSessions.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeSessions.map((session) => {
              const isLive = session.status === "running";
              return (
                <div
                  key={session.id}
                  className={`flex flex-col justify-between p-5 rounded-2xl border transition-all shadow-xs min-h-[230px] ${
                    isLive
                      ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08] border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-500/5"
                      : "bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5"
                  }`}
                >
                  {/* Top: Icon + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isLive
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isLive ? (
                        <Radio className="h-5 w-5 animate-pulse" />
                      ) : (
                        <Pause className="h-5 w-5" />
                      )}
                    </div>
                    <StatusBadge status={session.status} />
                  </div>

                  {/* Middle: Course, Topic, Code */}
                  <div className="space-y-1.5 my-3 flex-1">
                    <p className="text-[11px] font-semibold text-[#86868b] truncate">
                      {session.courseTitle}
                    </p>
                    <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] line-clamp-2 leading-snug">
                      {session.topic}
                    </h3>
                    {session.meeting_code && (
                      <span className="inline-block font-mono text-[10px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5">
                        {session.meeting_code}
                      </span>
                    )}
                  </div>

                  {/* Bottom Action (Standardized h-10 rounded-full) */}
                  <AppButton
                    size="sm"
                    asChild
                    variant={isLive ? "success" : "primary"}
                    shape="pill"
                    className="w-full h-10 text-xs font-semibold shrink-0 shadow-xs"
                    leftIcon={<Play className="h-3.5 w-3.5 fill-current" />}
                    rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    <Link href={`/classroom/${session.id}`}>
                      <span>{isLive ? "Enter Live Studio" : "Resume Studio"}</span>
                    </Link>
                  </AppButton>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. Academic Course Spaces (Instant Feedback & Direct Access) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#0071e3]" />
            <h2 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              Academic Course Spaces
            </h2>
          </div>
          <span className="text-[11px] text-[#86868b] font-medium">
            {courses.length} Course{courses.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl w-full" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#86868b] mx-auto">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">No Course Spaces Yet</p>
              <p className="text-[11px] text-[#86868b] mt-0.5">
                Create a course space to upload course materials and launch AI lectures.
              </p>
            </div>
            {isLecturer && (
              <CreateCourseDialog
                onCreated={loadData}
                trigger={
                  <AppButton
                    variant="primary"
                    shape="pill"
                    size="sm"
                    className="px-4 h-9 font-medium text-xs shadow-xs"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    <span>Create First Course</span>
                  </AppButton>
                }
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/course/${course.id}`}
                className="group flex flex-col justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] hover:border-black/15 dark:hover:border-white/20 transition-all shadow-xs hover:shadow-md min-h-[170px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#86868b] group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] line-clamp-1 group-hover:text-[#0071e3] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-[11px] text-[#86868b] line-clamp-2 mt-1">
                      {course.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[#86868b]">
                  <span className="flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    Open Space
                  </span>
                  <span>
                    {new Date(course.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Recent Sessions (Square / Tall Cards Grid) ─────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-[#0071e3]" />
            <h2 className="text-sm font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              Recent Sessions
            </h2>
          </div>
          <span className="text-[11px] text-[#86868b] font-medium">
            {recentSessions.length} total
          </span>
        </div>

        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-56 rounded-2xl w-full" />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-2">
            <p className="text-xs text-[#86868b]">No previous sessions found.</p>
            {courses.length > 0 && (
              <p className="text-[11px] text-[#86868b]">
                Select a course above or in the sidebar to schedule your first lecture session.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="group flex flex-col justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] hover:border-black/15 dark:hover:border-white/20 transition-all shadow-xs min-h-[230px]"
              >
                {/* Top: Icon + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 text-[#0071e3] flex items-center justify-center shrink-0">
                    <Presentation className="h-4 w-4" />
                  </div>
                  <StatusBadge status={session.status} />
                </div>

                {/* Middle: Course, Topic, Code */}
                <div className="space-y-1.5 my-3 flex-1">
                  <p className="text-[11px] font-semibold text-[#86868b] truncate">
                    {session.courseTitle}
                  </p>
                  <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] line-clamp-2 leading-snug group-hover:text-[#0071e3] transition-colors">
                    {session.topic}
                  </h3>
                  <div className="flex items-center gap-2 pt-0.5">
                    {session.meeting_code && (
                      <span className="font-mono text-[10px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md">
                        {session.meeting_code}
                      </span>
                    )}
                    <span className="text-[10px] text-[#86868b] flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(session.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Bottom Action (Standardized h-10 rounded-full) */}
                <AppButton
                  size="sm"
                  asChild
                  variant="secondary"
                  shape="pill"
                  className="w-full h-10 px-4 text-xs font-semibold shrink-0 shadow-xs"
                  leftIcon={<Play className="h-3 w-3 fill-current" />}
                  rightIcon={<ArrowRight className="h-3 w-3 opacity-70 group-hover:opacity-100" />}
                >
                  <Link href={`/classroom/${session.id}`}>
                    <span>Enter Studio</span>
                  </Link>
                </AppButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
