"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useIsMounted } from "@/hooks/useIsMounted";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import type { Course, ClassroomSession } from "@/lib/supabase/types";
import { CreateCourseDialog } from "@/features/courses";
import { LectureScriptModal } from "@/features/classroom";
import { ClassNotesModal } from "@/features/sessions";
import { SessionCodeInput, StatusBadge, CopyCodeBadge, ScriptBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const hasMounted = useIsMounted();

  const { user, profile, isLecturer, isLoading: isAuthLoading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<
    (ClassroomSession & { courseTitle?: string })[]
  >([]);
  const [recentSessions, setRecentSessions] = useState<
    (ClassroomSession & { courseTitle?: string })[]
  >([]);
  const [loadingData, setLoadingData] = useState(true);
  const [scriptTarget, setScriptTarget] = useState<ClassroomSession | null>(null);
  const [notesTarget, setNotesTarget] = useState<ClassroomSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassroomSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleScriptUpdated = (updated: ClassroomSession) => {
    setActiveSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    );
    setRecentSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    );
    if (scriptTarget && scriptTarget.id === updated.id) {
      setScriptTarget(updated);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSession(deleteTarget.id);
      setActiveSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setRecentSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Session deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete session.";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const loadData = useCallback(async () => {
    if (isAuthLoading || !user) {
      setLoadingData(false);
      return;
    }
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
          } catch { }
        })
      );

      // Sort by newest
      allSessions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Filter: All ongoing/live/paused at the top; only the last 3 previous sessions below
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
      // Strictly show last 3 completed/previous sessions on home screen
      setRecentSessions(others.slice(0, 3));
    } catch (err: unknown) {
      if ((err as { status?: number })?.status !== 401) {
        console.error("Dashboard data load error:", err);
      }
    } finally {
      setLoadingData(false);
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!isAuthLoading && user) {
      queueMicrotask(() => {
        void loadData();
      });
    }

    // Listen to local window event triggered on course creation/deletion
    const handleCoursesChanged = () => {
      loadData();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:courses-changed", handleCoursesChanged);
    }

    // Subscribe to database realtime changes for courses & sessions
    let coursesChannel: any = null;
    let sessionsChannel: any = null;

    if (supabase?.channel) {
      try {
        coursesChannel = supabase
          .channel("dashboard:courses")
          ?.on(
            "postgres_changes",
            { event: "*", schema: "public", table: "courses" },
            () => {
              loadData();
            }
          )
          ?.subscribe();

        sessionsChannel = supabase
          .channel("dashboard:sessions")
          ?.on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sessions" },
            () => {
              loadData();
            }
          )
          ?.subscribe();
      } catch (err) {
        console.warn("Failed to subscribe in Dashboard:", err);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:courses-changed", handleCoursesChanged);
      }
      if (coursesChannel && supabase?.removeChannel) {
        try {
          supabase.removeChannel(coursesChannel);
        } catch {}
      }
      if (sessionsChannel && supabase?.removeChannel) {
        try {
          supabase.removeChannel(sessionsChannel);
        } catch {}
      }
    };
  }, [loadData, isAuthLoading, user]);

  if (!hasMounted || (isAuthLoading && !profile)) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
 <Skeleton className="h-8 w-48 " />
 <Skeleton className="h-10 w-64 " />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-60 w-full" />
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-foreground">
            Welcome back, {profile?.name || "Professor"}
          </h1>
          <p className="text-xs text-muted-foreground">
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
                <Button
                  variant="default"
                  size="sm"
 className=" h-10 "
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Course</span>
                </Button>
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2" />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live &amp; Paused Broadcasts ({activeSessions.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeSessions.map((session) => {
              const isLive = session.status === "running";
              return (
                <div
                  key={session.id}
                  className={`flex flex-col justify-between p-5 rounded-2xl border transition-all shadow-xs min-h-[230px] ${isLive
                      ? "bg-chart-2/[0.04] dark:bg-chart-2/[0.08] border-chart-2/30 hover:border-chart-2/60 shadow-chart-2/5"
                      : "bg-chart-4/5 dark:bg-chart-4/10 border-chart-4/30 hover:border-chart-4/60 shadow-chart-4/5"
                    }`}
                >
                  {/* Top: Icon + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isLive
                          ? "bg-chart-2/15 text-chart-2 dark:text-chart-2"
                          : "bg-chart-4/15 text-chart-4 dark:text-chart-4"
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
                    <p className="text-xs font-semibold text-muted-foreground truncate">
                      {session.courseTitle}
                    </p>
                    <h3 className="text-sm font-bold text-foreground dark:text-foreground line-clamp-2 leading-snug">
                      {session.topic}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {session.meeting_code && (
                        <CopyCodeBadge code={session.meeting_code} />
                      )}
                      <ScriptBadge
                        script={session.script}
                        onClick={() => setScriptTarget(session)}
                        isLecturer={isLecturer}
                      />
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      asChild
                      variant="default"
                      className="flex-1 h-10"
                    >
                      <Link href={`/classroom/${session.id}`} className="inline-flex items-center justify-center gap-1.5">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>{isLive ? "Enter Live Studio" : "Resume Studio"}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    {(session.status === "paused" || session.status === "ended") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNotesTarget(session)}
                        className="h-10 w-10 shrink-0 rounded-xl border-black/10 dark:border-white/10 text-primary hover:text-primary/80"
                        title="View Class Notes"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}

                    {isLecturer && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScriptTarget(session)}
                        className="h-10 w-10 shrink-0 rounded-xl border-black/10 dark:border-white/10 hover:text-primary"
                        title="View / Edit / Delete Script"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight text-foreground dark:text-foreground">
              Academic Course Spaces
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {courses.length} Course{courses.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : courses.length === 0 ? (
 <div className="p-8 border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-muted-foreground mx-auto">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground dark:text-foreground">No Course Spaces Yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a course space to upload course materials and launch AI lectures.
              </p>
            </div>
            {isLecturer && (
              <CreateCourseDialog
                onCreated={loadData}
                trigger={
                  <Button
                    variant="default"
                    size="sm"
 className=" h-9 "
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create First Course</span>
                  </Button>
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
                className="group flex flex-col justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card hover:border-black/15 dark:hover:border-white/20 transition-all shadow-xs hover:shadow-md min-h-[170px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground dark:text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {course.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-muted-foreground">
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
            <Presentation className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight text-foreground dark:text-foreground">
              Recent Sessions (Last {recentSessions.length})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Showing last {recentSessions.length} completed
          </span>
        </div>

        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : recentSessions.length === 0 ? (
 <div className="p-8 border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-2">
            <p className="text-xs text-muted-foreground">No previous sessions found.</p>
            {courses.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Select a course above or in the sidebar to schedule your first lecture session.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="group flex flex-col justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card hover:border-black/15 dark:hover:border-white/20 transition-all shadow-xs min-h-[230px]"
              >
                {/* Top: Icon + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 text-primary flex items-center justify-center shrink-0">
                    <Presentation className="h-4 w-4" />
                  </div>
                  <StatusBadge status={session.status} />
                </div>

                {/* Middle: Course, Topic, Code */}
                <div className="space-y-1.5 my-3 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground truncate">
                    {session.courseTitle}
                  </p>
                  <h3 className="text-sm font-bold text-foreground dark:text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {session.topic}
                  </h3>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {session.meeting_code && (
                        <CopyCodeBadge code={session.meeting_code} />
                      )}
                      <ScriptBadge
                        script={session.script}
                        onClick={() => setScriptTarget(session)}
                        isLecturer={isLecturer}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="h-3 w-3 shrink-0 opacity-70" />
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

                {/* Bottom Action */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    asChild
                    variant="secondary"
                    className="flex-1 h-10"
                  >
                    <Link href={`/classroom/${session.id}`} className="inline-flex items-center justify-center gap-1.5">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Enter Studio</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                    </Link>
                  </Button>

                  {(session.status === "ended" || session.status === "paused") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setNotesTarget(session)}
                      className="h-10 w-10 shrink-0 rounded-xl border-black/10 dark:border-white/10 text-primary hover:text-primary/80"
                      title="View Class Notes"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}

                  {isLecturer && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScriptTarget(session)}
                        className="h-10 w-10 shrink-0 rounded-xl border-black/10 dark:border-white/10 hover:text-primary"
                        title="View / Edit / Delete Script"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteTarget(session)}
                        className="h-10 w-10 shrink-0 rounded-xl border-black/10 dark:border-white/10 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                        title="Delete Session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Class Notes Modal */}
      {notesTarget && (
        <ClassNotesModal
          open={Boolean(notesTarget)}
          onOpenChange={(open) => !open && setNotesTarget(null)}
          session={notesTarget}
          isLecturer={isLecturer}
        />
      )}

      {/* Unified Lecture Script & Curriculum Modal */}
      {scriptTarget && (
        <LectureScriptModal
          open={Boolean(scriptTarget)}
          onOpenChange={(open) => !open && setScriptTarget(null)}
          topic={scriptTarget.topic}
          isLecturer={isLecturer}
          status={scriptTarget.status}
          rawScript={scriptTarget.script || ""}
          sessionId={scriptTarget.id}
          meetingCode={scriptTarget.meeting_code}
          onUpdated={handleScriptUpdated}
        />
      )}

      {/* Delete Session Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col justify-between p-8 sm:p-10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <Trash2 className="h-7 w-7" />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                  Permanently Delete Session?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  You are about to delete <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.topic}&rdquo;</span>.
                  This action is irreversible. All lecture transcripts, generated checkpoints, audio notes, and student attendance logs associated with this session will be permanently erased.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Topic:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">{deleteTarget?.topic}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold capitalize text-foreground">{deleteTarget?.status}</span>
                </div>
                {deleteTarget?.meeting_code && (
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Meeting Code:</span>
                    <span className="font-mono font-semibold text-primary">{deleteTarget?.meeting_code}</span>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>This session will be unrecoverable from the database.</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-row justify-end gap-3 pt-6 border-t border-border/50 shrink-0">
            <AlertDialogCancel disabled={deleting} className="rounded-xl px-5 h-11 text-sm font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deleting}
              className="rounded-xl px-6 h-11 text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Permanently Delete</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
