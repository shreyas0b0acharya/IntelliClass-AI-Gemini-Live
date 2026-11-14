"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { LectureItem } from "../types/lecture-item";
import { parseLectureScript } from "../types/lecture-item";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Volume2,
  Clock,
  HelpCircle,
  Play,
  CheckCircle2,
  Sparkles,
  Edit3,
  List,
  Save,
  Loader2,
  X,
  Copy,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ClassroomSession } from "@/lib/supabase/types";

export interface LectureScriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: LectureItem[];
  currentIndex?: number;
  topic: string;
  isLecturer: boolean;
  status?: string;
  rawScript?: string;
  sessionId?: string;
  meetingCode?: string;
  onSaveScript?: (newScript: string) => Promise<void>;
  onDeleteScript?: () => Promise<void>;
  onUpdated?: (updated: ClassroomSession) => void;
  onStartSession?: () => void;
}

export function LectureScriptModal({
  open,
  onOpenChange,
  items: passedItems,
  currentIndex = 0,
  topic,
  isLecturer,
  status = "created",
  rawScript = "",
  sessionId,
  meetingCode,
  onSaveScript,
  onDeleteScript,
  onUpdated,
  onStartSession,
}: LectureScriptModalProps) {
  const [viewMode, setViewMode] = useState<"cards" | "edit">("cards");
  const [editedScript, setEditedScript] = useState<string>(rawScript);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync editedScript whenever modal opens or rawScript updates (stripping legacy [PAUSE] tags)
  useEffect(() => {
    if (open) {
      const sanitized = (rawScript || "").replace(/\[PAUSE\]/gi, " ").trim();
      setEditedScript(sanitized);
      if (!sanitized || sanitized.length === 0) {
        setViewMode("edit");
      } else {
        setViewMode("cards");
      }
    }
  }, [open, rawScript]);

  // Compute items if not passed explicitly
  const items: LectureItem[] = useMemo(() => {
    if (passedItems && passedItems.length > 0) return passedItems;
    if (rawScript && rawScript.trim().length > 0) {
      return parseLectureScript(rawScript).items;
    }
    return [];
  }, [passedItems, rawScript]);

  const speechCount = items.filter((i) => i.type === "speech").length;
  const totalWords = items
    .filter((i) => i.type === "speech")
    .reduce((acc, i) => acc + (i.type === "speech" ? i.text.split(/\s+/).filter(Boolean).length : 0), 0);
  const estDurationMin = Math.max(1, Math.round(totalWords / 130));

  const handleCopyScript = () => {
    const textToCopy = editedScript || rawScript;
    if (!textToCopy?.trim()) {
      toast.error("No script text to copy.");
      return;
    }
    navigator.clipboard.writeText(textToCopy);
    toast.success("Full lecture script copied to clipboard!");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSaveScript) {
        await onSaveScript(editedScript.trim());
      } else if (sessionId) {
        const { session: updated } = await api.updateClassroomSession(sessionId, {
          script: editedScript.trim(),
        });
        if (onUpdated && updated) {
          onUpdated(updated);
        }
      }
      toast.success("Lecture script saved successfully!");
      setViewMode("cards");
    } catch {
      toast.error("Failed to save edited script.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (onDeleteScript) {
        await onDeleteScript();
      } else if (sessionId) {
        const { session: updated } = await api.updateClassroomSession(sessionId, {
          script: "",
        });
        if (onUpdated && updated) {
          onUpdated(updated);
        }
      }
      setEditedScript("");
      toast.success("Lecture script deleted.");
      setShowDeleteConfirm(false);
      setViewMode("edit");
    } catch {
      toast.error("Failed to delete script.");
    } finally {
      setIsDeleting(false);
    }
  };

  const insertTag = (tag: string) => {
    setEditedScript((prev) => (prev ? `${prev} ${tag} ` : `${tag} `));
  };

  const canSave = Boolean(onSaveScript || sessionId);
  const canDelete = Boolean(onDeleteScript || sessionId);
  const hasScriptContent = Boolean(rawScript?.trim() || editedScript?.trim());

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-[96vw] sm:w-[92vw] md:w-[88vw] lg:w-[82vw] max-w-[96vw] sm:max-w-[92vw] md:max-w-[88vw] lg:max-w-[85vw] max-h-[92vh] h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl sm:rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
        >
          {/* Header */}
          <DialogHeader className="shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/50 bg-card/40 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              {/* Title & Topic Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                      Curriculum &amp; Lecture Script
                    </DialogTitle>
                    {meetingCode && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                        Code: {meetingCode}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs text-muted-foreground truncate mt-0.5"
                    title={`${topic} • ${items.length} segments • ~${estDurationMin} mins`}
                  >
                    {topic} &bull; {items.length} segments &bull; ~{estDurationMin} mins
                  </p>
                </div>
              </div>

              {/* Action Buttons & Close Button */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-end sm:self-center flex-wrap sm:flex-nowrap">
                {/* Copy script button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyScript}
                  disabled={!hasScriptContent}
                  className="h-9 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl border-border/70 hover:bg-muted transition-all shadow-2xs"
                  title="Copy full script"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>

                {/* Delete script button */}
                {isLecturer && canDelete && hasScriptContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-9 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 transition-all shadow-2xs"
                    title="Delete script text"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete Script</span>
                  </Button>
                )}

                {/* Toggle Segment View / Edit Script */}
                {isLecturer && canSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (viewMode === "cards") {
                        setEditedScript(
                          rawScript ||
                            items
                              .map((i) => (i.type === "speech" ? i.text : `[${i.type.toUpperCase()}]`))
                              .join(" ")
                        );
                        setViewMode("edit");
                      } else {
                        setViewMode("cards");
                      }
                    }}
                    className="h-9 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl border-border/70 hover:bg-muted transition-all shadow-2xs"
                  >
                    {viewMode === "cards" ? (
                      <Edit3 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <List className="h-3.5 w-3.5" />
                    )}
                    <span>{viewMode === "cards" ? "Edit Script" : "Segment View"}</span>
                  </Button>
                )}

                {/* Start or Resume Live Session (Classroom) */}
                {isLecturer && (status === "created" || status === "paused") && onStartSession && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      onOpenChange(false);
                      onStartSession();
                    }}
                    disabled={items.length === 0}
                    className="h-9 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                    <span>{status === "paused" ? "Resume Class" : "Start Live Broadcast"}</span>
                  </Button>
                )}

                {/* Direct Link to Studio if accessed from outside classroom */}
                {!onStartSession && sessionId && (
                  <Button
                    size="sm"
                    variant="default"
                    asChild
                    className="h-9 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all shrink-0"
                  >
                    <Link href={`/classroom/${sessionId}`}>
                      <Play className="h-3.5 w-3.5 fill-currentColor" />
                      <span>{status === "running" ? "Enter Live" : "Open Studio"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}

                {/* Close Button */}
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    aria-label="Close dialog"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 pt-3 border-t border-border/40 text-center">
              <div className="p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/30">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                  Speech Segments
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-foreground">
                  {speechCount} Sentences
                </span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/30">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                  Word Count
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-foreground">
                  {totalWords} Words
                </span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/30">
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                  {status === "running" ? "Live Progress" : "Estimated Time"}
                </span>
                {status === "running" ? (
                  <span className="text-xs font-mono font-bold text-primary">
                    {items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0}% Complete
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm font-mono font-bold text-primary flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{estDurationMin} min
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content Area - Scrolls independently */}
          <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-3.5">
            {viewMode === "edit" ? (
              <div className="space-y-4 max-w-6xl mx-auto h-full flex flex-col">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>
                    Fine-tune the lecture script below. Insert engagement checkpoints or visual assets to pace the AI avatar.
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => insertTag("[ENGAGEMENT]")}
                      className="px-2 py-0.5 rounded-md bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      + [ENGAGEMENT]
                    </button>
                  </div>
                </div>

                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  placeholder="Paste or write the lecture script here..."
                  className="flex-1 min-h-[360px] w-full resize-y font-mono text-xs sm:text-sm leading-relaxed p-4 rounded-2xl bg-card border-border/60 shadow-inner"
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>{editedScript.split(/\s+/).filter(Boolean).length} words</span>
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditedScript(rawScript || "");
                        setViewMode("cards");
                      }}
                      className="h-9 px-4 rounded-xl"
                    >
                      <span>Cancel</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="h-9 px-4 rounded-xl inline-flex items-center gap-1.5 shadow-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Script</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center space-y-3 border border-dashed border-black/10 dark:border-white/10 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] max-w-md mx-auto my-auto">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-muted-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">No script generated yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                    Generate the lecture script from course syllabus materials or edit the script text directly before starting the broadcast.
                  </p>
                </div>
                {isLecturer && canSave && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setViewMode("edit")}
                    className="h-9 px-4 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Write or Paste Script</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3.5 max-w-6xl mx-auto pb-4">
                {items.map((item, idx) => {
                  const isCurrent = idx === currentIndex && status === "running";
                  const isCompleted = idx < currentIndex && status === "running";

                  if (item.type === "speech") {
                    return (
                      <div
                        key={item.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isCurrent
                            ? "bg-primary/10 border-primary/40 ring-1 ring-ring/40 shadow-sm"
                            : isCompleted
                              ? "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70"
                              : "bg-card dark:bg-muted/40 border-border/60 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <Volume2 className="h-3.5 w-3.5" />
                              Speech Segment
                            </span>
                          </div>

                          {isCurrent ? (
                            <span className="text-xs font-bold text-chart-2 dark:text-chart-2 bg-chart-2/15 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Sparkles className="h-2.5 w-2.5" />
                              NOW SPEAKING
                            </span>
                          ) : isCompleted ? (
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-chart-2" /> Spoken
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {item.text.split(/\s+/).filter(Boolean).length} words
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-xs sm:text-sm leading-relaxed font-medium ${
                            isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {item.text}
                        </p>
                      </div>
                    );
                  }

                  if (item.type === "engagement") {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-chart-4/10 border border-chart-4/20 text-xs text-chart-4 dark:text-chart-4 flex items-start gap-3"
                      >
                        <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs uppercase tracking-wider">
                            Engagement Checkpoint
                          </p>
                          <p className="text-xs sm:text-sm text-foreground mt-0.5">
                            {item.prompt || "Check your understanding"}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === "image" || item.type === "video") {
                    const resolvedUrl = item.mediaRef.startsWith("/api/media/")
                      ? item.mediaRef
                      : item.mediaRef.replace(/course-files\/(.+)$/, "/api/media/$1");

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "bg-chart-5/15 border-chart-5/40 ring-1 ring-chart-5/40 shadow-sm"
                            : "bg-chart-5/5 dark:bg-chart-5/10 border-chart-5/20"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-14 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-black/10 dark:border-white/10 flex items-center justify-center">
                            {item.type === "video" ? (
                              <video src={resolvedUrl} className="w-full h-full object-cover" muted />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolvedUrl}
                                alt={item.caption || "Visual asset"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-muted-foreground bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md">
                                #{idx + 1}
                              </span>
                              <p className="font-bold text-xs uppercase tracking-wider text-chart-5 dark:text-chart-5">
                                Projected {item.type === "video" ? "Video" : "Slide"}
                              </p>
                            </div>
                            <p
                              className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-sm sm:max-w-xl mt-0.5"
                              title={item.caption || item.mediaRef}
                            >
                              {item.caption || "Visual Diagram Asset"}
                            </p>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="text-xs font-bold text-chart-5 dark:text-chart-5 bg-chart-5/15 px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse shrink-0">
                            <Sparkles className="h-2.5 w-2.5" />
                            ON STAGE
                          </span>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Script Confirmation Alert */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete Generated Script?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to clear this session's generated lecture script? You can still regenerate a fresh script anytime from course materials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Yes, Delete Script</span>
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isDeleting} className="w-full mt-0 h-9">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
