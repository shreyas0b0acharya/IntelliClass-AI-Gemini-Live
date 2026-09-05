"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ClassroomSession } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { EditSessionDialog } from "./EditSessionDialog";
import { DEFAULT_MALE_VOICE_ID, DEFAULT_FEMALE_VOICE_ID } from "@/config";
import { StatusBadge } from "@/components/shared";
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
  Radio,
  Play,
  ArrowRight,
  Calendar,
  Sparkles,
  Pencil,
  Trash2,
  RotateCcw,
  Users,
  Lock,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Copy,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

interface SessionListProps {
  courseId: string;
  isLecturer?: boolean;
}

interface SessionCardProps {
  session: ClassroomSession;
  isLecturer: boolean;
  onEdit: (s: ClassroomSession) => void;
  onDelete: (s: ClassroomSession) => void;
  onRestart: (s: ClassroomSession) => void;
  restarting: string | null;
}

function SessionCard({
  session,
  isLecturer,
  onEdit,
  onDelete,
  onRestart,
  restarting,
}: SessionCardProps) {
  const isLive = session.status === "running";
  const isPaused = session.status === "paused";
  const isEnded = session.status === "ended";

  const formattedDate = new Date(session.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const voiceLabel =
    session.voice_id === DEFAULT_FEMALE_VOICE_ID
      ? "Prof. Bella (F)"
      : session.voice_id === DEFAULT_MALE_VOICE_ID
        ? "Prof. Sharma (M)"
        : session.voice_id || "Default Voice";

  const meetingCode = session.meeting_code || session.id.slice(0, 8);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/session/${encodeURIComponent(meetingCode)}`;
    navigator.clipboard.writeText(url);
    toast.success(`Student session link copied! Code: ${meetingCode}`);
  };

  return (
    <div
      className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all shadow-xs ${isLive
          ? "bg-chart-2/[0.03] dark:bg-chart-2/[0.06] border-chart-2/30 hover:border-chart-2/50"
          : isPaused
            ? "bg-chart-4/5 dark:bg-chart-4/5 border-chart-4/30 hover:border-chart-4/50"
            : "bg-muted dark:bg-card border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
        }`}
    >
      {/* Left: Icon + Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isLive
              ? "bg-chart-2/15 text-chart-2 dark:text-chart-2"
              : isPaused
                ? "bg-chart-4/15 text-chart-4 dark:text-chart-4"
                : "bg-black/5 dark:bg-white/10 text-primary"
            }`}
        >
          {isLive ? (
            <Radio className="h-5 w-5 animate-pulse" />
          ) : isPaused ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-foreground dark:text-foreground truncate max-w-xs sm:max-w-md">
              {session.topic}
            </h4>
            <StatusBadge status={session.status} stoppedReason={session.stopped_reason} />
            <span className="font-mono text-xs bg-black/5 dark:bg-white/10 text-foreground dark:text-foreground px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5 font-semibold">
              {meetingCode}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
            <span>&bull;</span>
            <span>{voiceLabel}</span>
            {isLive && (
              <>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-chart-2 dark:text-chart-2 font-semibold">
                  <Users className="h-3 w-3" />
                  Live Broadcast
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions Toolbar & Primary CTA */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {/* Horizontal Utility Toolbar */}
        <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] p-1 rounded-xl border border-black/5 dark:border-white/5">
          {/* Copy student link button */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyLink}
 className="h-8 w-8 "
            title="Copy student join link"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>

          {/* Lecturer actions */}
          {isLecturer && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onEdit(session)}
 className="h-8 w-8 "
                title="Edit session"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRestart(session)}
                disabled={restarting === session.id}
 className="h-8 w-8 "
                title="Reset session"
              >
                {restarting === session.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(session)}
 className="h-8 w-8 "
                title="Delete session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Primary CTA Button (h-10 rounded-full) */}
        {isLecturer && (
          <Button
            asChild
            size="sm"
            variant="default"
 className={`h-10 ${
 isLive ? " " : ""
            }`}
          >
            <Link href={`/classroom/${session.id}`} className="inline-flex items-center gap-1.5">
              <span>{isLive ? "Broadcast" : "Open"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}

        {/* Student actions */}
        {!isLecturer && (
          <>
            {isLive ? (
              <Button
                asChild
                size="sm"
                variant="default"
 className="h-10 "
              >
                <Link href={`/classroom/${session.id}`} className="inline-flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5" />
                  <span>Join Live</span>
                </Link>
              </Button>
            ) : !isEnded ? (
              <Button
                asChild
                size="sm"
                variant="default"
 className="h-10 "
              >
                <Link href={`/classroom/${session.id}`} className="inline-flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Join Room</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-3.5 h-9 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5">
                <Lock className="h-3.5 w-3.5" />
                <span>Ended</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function SessionList({ courseId, isLecturer = false }: SessionListProps) {
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<ClassroomSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassroomSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { sessions: fetchedSessions } = await api.getCourseSessions(courseId);
      if (fetchedSessions) setSessions(fetchedSessions.filter((s) => (s.status as string) !== "deleted"));
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    api.getCourseSessions(courseId)
      .then(({ sessions: fetched }) => {
        if (active && fetched) setSessions(fetched.filter((s) => (s.status as string) !== "deleted"));
      })
      .catch((err) => console.error("Error fetching sessions:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`db:sessions:list:${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [courseId, fetchSessions]);

  const handleEdit = (session: ClassroomSession) => {
    setEditTarget(session);
  };

  const handleUpdated = (updated: ClassroomSession) => {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSession(deleteTarget.id);
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Session deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete session.";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleRestart = async (session: ClassroomSession) => {
    setRestarting(session.id);
    try {
      await api.updateClassroomSession(session.id, {
        status: "created",
        current_item_id: "",
        current_sentence_index: 0,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, status: "created", current_item_id: undefined, current_sentence_index: 0 }
            : s
        )
      );
      toast.success("Session reset to ready state.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restart session.";
      toast.error(msg);
    } finally {
      setRestarting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
 <Skeleton className="w-11 h-11 shrink-0" />
              <div className="space-y-2 flex-1 max-w-md">
                <div className="flex items-center gap-2">
 <Skeleton className="h-4 w-48 " />
 <Skeleton className="h-4 w-16 " />
                </div>
 <Skeleton className="h-3 w-32 " />
              </div>
            </div>
 <Skeleton className="h-10 w-32 shrink-0 self-end sm:self-center" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-10 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-muted-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground dark:text-foreground">No classroom sessions yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          {isLecturer
            ? "Click 'New AI Lecture' above to generate and broadcast your first lecture."
            : "Live lectures by your professor will appear here. Come back when a session goes live."}
        </p>
      </div>
    );
  }

  // Split into live/active vs history
  const liveSessions = sessions.filter(
    (s) => s.status === "running" || s.status === "paused"
  );
  const historySessions = sessions.filter(
    (s) => s.status === "created" || s.status === "ended"
  );

  const sharedCardProps = {
    isLecturer,
    onEdit: handleEdit,
    onDelete: setDeleteTarget,
    onRestart: handleRestart,
    restarting,
  };

  return (
    <div className="space-y-6">
      {/* Live / Active Sessions */}
      {liveSessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2" />
            </span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live &amp; Active Broadcasts
            </h3>
          </div>
          <div className="space-y-3">
            {liveSessions.map((sess) => (
              <SessionCard key={sess.id} session={sess} {...sharedCardProps} />
            ))}
          </div>
        </section>
      )}

      {/* History / Upcoming Sessions */}
      {historySessions.length > 0 && (
        <section className="space-y-3">
          <button
            className="flex items-center gap-2 w-full text-left group cursor-pointer p-1"
            onClick={() => setHistoryExpanded((v) => !v)}
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground dark:group-hover:text-white transition-colors">
              Session History
              <span className="ml-2 text-xs font-semibold bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full text-foreground dark:text-foreground">
                {historySessions.length}
              </span>
            </h3>
            <span className="ml-auto text-muted-foreground">
              {historyExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </button>

          {historyExpanded && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {historySessions.map((sess) => (
                <SessionCard key={sess.id} session={sess} {...sharedCardProps} />
              ))}
            </div>
          )}

          {!historyExpanded && historySessions.length > 0 && (
            <div
              className="text-center text-xs text-muted-foreground cursor-pointer hover:text-foreground dark:hover:text-white transition-colors py-2"
              onClick={() => setHistoryExpanded(true)}
            >
              Click to view {historySessions.length} past session{historySessions.length > 1 ? "s" : ""}
            </div>
          )}
        </section>
      )}

      {/* No live sessions notice for students */}
      {!isLecturer && liveSessions.length === 0 && historySessions.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            No live broadcast active right now. You can join when a professor starts broadcasting.
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <EditSessionDialog
          session={editTarget}
          open={Boolean(editTarget)}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Delete Confirm Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
 <AlertDialogContent className=" overflow-hidden max-w-sm ">
 <div className="p-6 border-b border-black/5 ">
            <AlertDialogHeader>
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
 <AlertDialogTitle className="">Delete Session?</AlertDialogTitle>
 <AlertDialogDescription className=" mt-1 ">
 <span className="font-semibold ">
                  &ldquo;{deleteTarget?.topic}&rdquo;
                </span>{" "}
                will be permanently deleted along with all its messages and data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
 <AlertDialogFooter className=" flex-col sm:flex-col">
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
 className="w-full h-10 "
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Yes, Delete Session</>
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={deleting}
 className="w-full h-10 mt-0 "
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
