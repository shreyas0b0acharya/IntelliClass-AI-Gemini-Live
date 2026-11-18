"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ClassroomSession } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { EditSessionDialog } from "./EditSessionDialog";
import { ClassNotesModal, extractSessionNotes } from "./ClassNotesModal";
import { LectureScriptModal } from "@/features/classroom";
import { enforcePersonaConsistency } from "@/features/avatar";
import { DEFAULT_MALE_VOICE_ID, DEFAULT_FEMALE_VOICE_ID } from "@/config";
import { StatusBadge, CopyCodeBadge, ScriptBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
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
  onManageScript: (s: ClassroomSession) => void;
  onRepeat?: (s: ClassroomSession) => void;
  restarting: string | null;
  repeating?: string | null;
}

function SessionCard({
  session,
  isLecturer,
  onEdit,
  onDelete,
  onRestart,
  onManageScript,
  onRepeat,
  restarting,
  repeating,
}: SessionCardProps) {
  const [showNotesModal, setShowNotesModal] = useState(false);
  const isLive = session.status === "running";
  const isPaused = session.status === "paused";
  const isEnded = session.status === "ended";

  const notesData = extractSessionNotes(session);

  const formattedDate = new Date(session.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const persona = enforcePersonaConsistency(session.avatar_model, session.voice_id);
  const voiceLabel =
    persona.gender === "female"
      ? `Dr. Clara (${persona.voiceId} • F)`
      : `Prof. Arthur (${persona.voiceId} • M)`;

  const meetingCode = session.meeting_code || session.id.slice(0, 8);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/session/${encodeURIComponent(meetingCode)}`;
    navigator.clipboard.writeText(url);
    toast.success(`Student session link copied! Code: ${meetingCode}`);
  };

  return (
    <div
      className={`group flex flex-col p-5 rounded-2xl border transition-all shadow-xs ${isLive
          ? "bg-chart-2/[0.03] dark:bg-chart-2/[0.06] border-chart-2/30 hover:border-chart-2/50"
          : isPaused
            ? "bg-chart-4/5 dark:bg-chart-4/5 border-chart-4/30 hover:border-chart-4/50"
            : "bg-muted dark:bg-card border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
        }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
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
              <CopyCodeBadge code={meetingCode} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </span>
              <span>&bull;</span>
              <span>{voiceLabel}</span>
              <span>&bull;</span>
              <ScriptBadge
                script={session.script}
                onClick={() => onManageScript(session)}
                isLecturer={isLecturer}
              />
              {(isEnded || isPaused) && (
                <>
                  <span>&bull;</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotesModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                    title="View Class Notes & Summary"
                  >
                    <FileText className="h-3 w-3" />
                    <span>{notesData.statusBadgeText || `Class Notes (${notesData.notesList.length})`}</span>
                  </button>
                </>
              )}
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
            {/* Class Notes shortcut button for completed or paused classes */}
            {(isEnded || isPaused) && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowNotesModal(true)}
                className="h-8 w-8 text-primary hover:text-primary/80"
                title="View Class Notes & Summary"
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            )}

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
                {isEnded && onRepeat && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRepeat(session)}
                    disabled={repeating === session.id}
                    className="h-8 w-8 text-primary hover:text-primary/80"
                    title="Repeat Class (Clone configuration into fresh session)"
                  >
                    {repeating === session.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onManageScript(session)}
                  className="h-8 w-8 text-foreground hover:text-primary"
                  title="View & Edit Lecture Script"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
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

      {/* Inline Notes Preview for Completed / Paused Classes */}
      {(isEnded || isPaused) && (
        <div className="w-full mt-3 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{isEnded ? "Completed Class Notes" : "Paused Class Notes Checkpoint"}</span>
              <span className="text-[10px] text-muted-foreground font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                {notesData.statusBadgeText}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className="text-primary hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Notes</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div
            onClick={() => setShowNotesModal(true)}
            className="text-xs text-muted-foreground line-clamp-2 bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer font-normal"
          >
            {notesData.previewSnippet}
          </div>
        </div>
      )}

      {/* Class Notes Modal */}
      <ClassNotesModal
        open={showNotesModal}
        onOpenChange={setShowNotesModal}
        session={session}
        isLecturer={isLecturer}
      />
    </div>
  );
}

export function SessionList({ courseId, isLecturer = false }: SessionListProps) {
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<ClassroomSession | null>(null);
  const [scriptTarget, setScriptTarget] = useState<ClassroomSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassroomSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [repeating, setRepeating] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "drafts" | "scheduled" | "active" | "history">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(true);

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

    let channel: any = null;
    if (courseId && supabase?.channel) {
      try {
        channel = supabase
          .channel(`db:sessions:list:${courseId}`)
          ?.on(
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
          ?.subscribe();
      } catch (err) {
        console.warn("Failed to subscribe to sessions channel:", err);
      }
    }

    return () => {
      active = false;
      if (channel && supabase?.removeChannel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
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

  const handleRepeat = async (session: ClassroomSession) => {
    setRepeating(session.id);
    try {
      await api.repeatClass(session.id);
      toast.success(`Cloned "${session.topic}" for repeat broadcast!`);
      await fetchSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to repeat session.";
      toast.error(msg);
    } finally {
      setRepeating(null);
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
    onManageScript: (session: ClassroomSession) => setScriptTarget(session),
    onRepeat: handleRepeat,
    restarting,
    repeating,
  };

  const filteredSessions = sessions.filter((s) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTopic = s.topic.toLowerCase().includes(q);
      const matchCode = (s.meeting_code || "").toLowerCase().includes(q);
      if (!matchTopic && !matchCode) return false;
    }

    if (filterTab === "drafts") return s.status === "draft";
    if (filterTab === "scheduled") {
      return (
        s.status === "scheduled" ||
        Boolean(s.target_epoch_ms && s.target_epoch_ms > Date.now())
      );
    }
    if (filterTab === "active") return s.status === "running" || s.status === "paused";
    if (filterTab === "history") return s.status === "ended";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Status Filter Bar & Search ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={filterTab === "all" ? "default" : "ghost"}
            size="xs"
            onClick={() => setFilterTab("all")}
            className="h-8 text-xs font-semibold"
          >
            <span>All ({sessions.length})</span>
          </Button>
          <Button
            type="button"
            variant={filterTab === "active" ? "default" : "ghost"}
            size="xs"
            onClick={() => setFilterTab("active")}
            className="h-8 text-xs font-semibold"
          >
            <span>Active ({sessions.filter((s) => s.status === "running" || s.status === "paused").length})</span>
          </Button>
          <Button
            type="button"
            variant={filterTab === "scheduled" ? "default" : "ghost"}
            size="xs"
            onClick={() => setFilterTab("scheduled")}
            className="h-8 text-xs font-semibold"
          >
            <span>Scheduled ({sessions.filter((s) => s.status === "scheduled" || Boolean(s.target_epoch_ms && s.target_epoch_ms > Date.now())).length})</span>
          </Button>
          <Button
            type="button"
            variant={filterTab === "drafts" ? "default" : "ghost"}
            size="xs"
            onClick={() => setFilterTab("drafts")}
            className="h-8 text-xs font-semibold"
          >
            <span>Drafts ({sessions.filter((s) => s.status === "draft").length})</span>
          </Button>
          <Button
            type="button"
            variant={filterTab === "history" ? "default" : "ghost"}
            size="xs"
            onClick={() => setFilterTab("history")}
            className="h-8 text-xs font-semibold"
          >
            <span>History ({sessions.filter((s) => s.status === "ended").length})</span>
          </Button>
        </div>

        <div className="relative w-full sm:w-60">
          <Input
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs bg-white dark:bg-card"
          />
        </div>
      </div>

      {/* Filtered Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No classes match the selected filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((sess) => (
            <SessionCard key={sess.id} session={sess} {...sharedCardProps} />
          ))}
        </div>
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
          onOpenScript={(s) => setScriptTarget(s)}
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
          onUpdated={handleUpdated}
        />
      )}

      {/* Delete Confirm Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col justify-between p-8 sm:p-10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <Trash2 className="h-7 w-7" />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                  Permanently Delete Class?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  You are about to delete <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.topic}&rdquo;</span>.
                  This action is irreversible. All lecture transcripts, checkpoint notes, and student attendance logs associated with this session will be permanently erased.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Class Summary</h4>
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
                <span>⚠️ Once deleted, this class record and its student activity cannot be restored.</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-row justify-end gap-3 pt-6 border-t border-border/50 shrink-0">
            <AlertDialogCancel
              disabled={deleting}
              className="rounded-xl px-5 h-11 text-sm font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl px-6 h-11 text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-2"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Yes, Delete Session</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
