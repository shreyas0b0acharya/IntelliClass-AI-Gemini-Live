"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ClassroomSession } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { EditSessionDialog } from "./EditSessionDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  const canJoin = !isEnded;
  const studentCanJoin = !isEnded;

  const formattedDate = new Date(session.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const voiceLabel =
    session.voice_id === "af_bella"
      ? "Prof. Bella (F)"
      : session.voice_id === "am_fenrir"
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
      className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all shadow-xs ${
        isLive
          ? "bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06] border-emerald-500/30 hover:border-emerald-500/50"
          : isPaused
          ? "bg-amber-500/[0.03] dark:bg-amber-500/[0.06] border-amber-500/30 hover:border-amber-500/50"
          : "bg-[#f5f5f7] dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
      }`}
    >
      {/* Left: Icon + Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isLive
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isPaused
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-black/5 dark:bg-white/10 text-[#0071e3]"
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
            <h4 className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-xs sm:max-w-md">
              {session.topic}
            </h4>
            <StatusBadge status={session.status} stoppedReason={session.stopped_reason} />
            <span className="font-mono text-[10px] bg-black/5 dark:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5 font-semibold">
              {meetingCode}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#86868b] font-medium flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
            <span>&bull;</span>
            <span>{voiceLabel}</span>
            {isLive && (
              <>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
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
          <button
            onClick={handleCopyLink}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Copy student join link"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          {/* Lecturer actions */}
          {isLecturer && (
            <>
              <button
                onClick={() => onEdit(session)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Edit session"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onRestart(session)}
                disabled={restarting === session.id}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-[#0071e3] hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                title="Reset session"
              >
                {restarting === session.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0071e3]" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => onDelete(session)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Delete session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Primary CTA Button (h-10 rounded-full) */}
        {isLecturer && (
          <Button
            asChild
            size="sm"
            className={`rounded-full h-10 px-5 font-medium text-xs sm:text-sm gap-2 shadow-xs cursor-pointer ${
              isLive
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-[#0071e3] hover:bg-[#0077ed] text-white"
            }`}
          >
            <Link href={`/classroom/${session.id}`}>
              {isLive ? "Broadcast" : "Open"}
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
                className="rounded-full font-medium gap-2 h-10 px-5 shadow-xs bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm"
              >
                <Link href={`/classroom/${session.id}`}>
                  <Radio className="h-3.5 w-3.5" />
                  Join Live
                </Link>
              </Button>
            ) : !isEnded ? (
              <Button
                asChild
                size="sm"
                className="rounded-full font-medium gap-2 h-10 px-5 bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs sm:text-sm shadow-xs"
              >
                <Link href={`/classroom/${session.id}`}>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Join Room
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-[#86868b] font-medium px-3.5 h-9 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5">
                <Lock className="h-3.5 w-3.5" />
                Ended
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
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1 max-w-md">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-48 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-10 w-32 rounded-full shrink-0 self-end sm:self-center" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-10 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-[#86868b]">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">No classroom sessions yet</p>
        <p className="text-xs text-[#86868b] max-w-xs mx-auto leading-relaxed">
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
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
            <Clock className="h-3.5 w-3.5 text-[#86868b]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] group-hover:text-[#1d1d1f] dark:group-hover:text-white transition-colors">
              Session History
              <span className="ml-2 text-[10px] font-semibold bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7]">
                {historySessions.length}
              </span>
            </h3>
            <span className="ml-auto text-[#86868b]">
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
              className="text-center text-xs text-[#86868b] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white transition-colors py-2"
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
          <Radio className="h-4 w-4 text-[#86868b] shrink-0" />
          <p className="text-xs text-[#86868b]">
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
        <AlertDialogContent className="rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl p-0 overflow-hidden max-w-sm bg-[#f5f5f7] dark:bg-[#1c1c1e]">
          <div className="p-6 border-b border-black/5 dark:border-white/10">
            <AlertDialogHeader>
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Delete Session?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-[#86868b] mt-1 leading-relaxed">
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  &ldquo;{deleteTarget?.topic}&rdquo;
                </span>{" "}
                will be permanently deleted along with all its messages and data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 pt-4 flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="w-full h-10 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-xs gap-2"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Yes, Delete Session</>
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={deleting}
              className="w-full h-10 rounded-full mt-0 border border-black/10 dark:border-white/10 font-medium text-xs bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
