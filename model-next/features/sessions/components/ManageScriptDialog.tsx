"use client";

import { useState, useEffect } from "react";
import type { ClassroomSession } from "@/lib/supabase/types";
import { parseLectureScript } from "@/features/classroom";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Edit3,
  List,
  Save,
  Trash2,
  Copy,
  Clock,
  Sparkles,
  Loader2,
  CheckCircle2,
  Volume2,
  HelpCircle,
  Play,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ManageScriptDialogProps {
  session: ClassroomSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: ClassroomSession) => void;
  isLecturer?: boolean;
}

export function ManageScriptDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
  isLecturer = true,
}: ManageScriptDialogProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [scriptText, setScriptText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session) {
      setScriptText(session.script || "");
      // If session has no script, default to edit tab so lecturer can paste or write
      if (!session.script) {
        setActiveTab("edit");
      } else {
        setActiveTab("preview");
      }
    }
  }, [session, open]);

  if (!session) return null;

  const parsed = parseLectureScript(scriptText);
  const speechItems = parsed.items.filter((i) => i.type === "speech");
  const totalWords = speechItems.reduce(
    (acc, i) => acc + (i.type === "speech" ? i.text.split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const estDurationMin = Math.max(1, Math.round(totalWords / 130));
  const hasScript = Boolean(scriptText && scriptText.trim().length > 0);

  const handleCopy = () => {
    if (!scriptText.trim()) {
      toast.error("No script text to copy.");
      return;
    }
    navigator.clipboard.writeText(scriptText);
    toast.success("Lecture script copied to clipboard!");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { session: updated } = await api.updateClassroomSession(session.id, {
        script: scriptText.trim(),
      });
      toast.success("Lecture script saved successfully!");
      if (onUpdated && updated) {
        onUpdated(updated);
      }
      setActiveTab("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save script.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScript = async () => {
    setDeleting(true);
    try {
      const { session: updated } = await api.updateClassroomSession(session.id, {
        script: "",
      });
      setScriptText("");
      toast.success("Lecture script deleted.");
      if (onUpdated && updated) {
        onUpdated(updated);
      }
      setShowDeleteConfirm(false);
      setActiveTab("edit");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete script.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const insertTag = (tag: string) => {
    setScriptText((prev) => (prev ? `${prev} ${tag} ` : `${tag} `));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] max-w-4xl max-h-[90vh] h-full flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl">
          {/* Header */}
          <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-black/5 dark:border-white/10 bg-muted/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                    Lecture Script &bull; {session.topic}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                    {session.meeting_code ? `Session Code: ${session.meeting_code}` : "Manage generated curriculum"}
                  </DialogDescription>
                </div>
              </div>

              {/* View/Edit Switcher & Quick Copy */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!hasScript}
                  className="h-8.5 px-2.5 text-xs inline-flex items-center gap-1.5 rounded-lg border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                  title="Copy full script"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>

                {isLecturer && hasScript && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8.5 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded-lg border-destructive/20"
                    title="Delete script"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete Script</span>
                  </Button>
                )}

                {isLecturer && (
                  <Button
                    variant={activeTab === "edit" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(activeTab === "edit" ? "preview" : "edit")}
                    className="h-8.5 px-3 text-xs inline-flex items-center gap-1.5 rounded-lg"
                  >
                    {activeTab === "edit" ? (
                      <>
                        <List className="h-3.5 w-3.5" />
                        <span>Curriculum View</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit Script</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Metrics Ribbon */}
            {hasScript && (
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/10 text-center">
                <div className="p-2 rounded-xl bg-background border border-black/5 dark:border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Speech Segments
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-foreground">
                    {speechItems.length} chunks
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-background border border-black/5 dark:border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Word Count
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-foreground">
                    {totalWords} words
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-background border border-black/5 dark:border-white/5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Estimated Time
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-primary flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{estDurationMin} min
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Main Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            {activeTab === "edit" ? (
              <div className="space-y-4 max-w-4xl mx-auto h-full flex flex-col">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>
                    Edit the lecture script. Insert pauses or engagement tags to pace the AI lecturer.
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => insertTag("[PAUSE]")}
                      className="px-2 py-0.5 rounded-md bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 font-mono text-[11px] font-semibold transition-colors"
                    >
                      + [PAUSE]
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("[ENGAGEMENT]")}
                      className="px-2 py-0.5 rounded-md bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 font-mono text-[11px] font-semibold transition-colors"
                    >
                      + [ENGAGEMENT]
                    </button>
                  </div>
                </div>

                <Textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Paste or write lecture script here..."
                  className="flex-1 min-h-[300px] sm:min-h-[360px] font-sans text-sm leading-relaxed p-4 rounded-xl border-black/10 dark:border-white/10 resize-none focus-visible:ring-1"
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>{scriptText.split(/\s+/).filter(Boolean).length} words</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScriptText(session.script || "");
                        setActiveTab("preview");
                      }}
                      className="h-9 px-3 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
            ) : !hasScript ? (
              <div className="p-10 text-center space-y-4 max-w-md mx-auto my-auto">
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-muted-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">No lecture script generated yet</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    This session doesn't have a generated lecture script. You can write or paste one manually, or generate it from course materials.
                  </p>
                </div>
                {isLecturer && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setActiveTab("edit")}
                      className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Write / Paste Script</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Link href={`/classroom/${session.id}`}>
                        <span>Open Studio to Generate</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl mx-auto pb-4">
                {parsed.items.map((item, idx) => {
                  if (item.type === "pause") {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-chart-1/30 bg-chart-1/5 text-chart-1 text-xs font-semibold"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>[Pause ~1.2s for student absorption]</span>
                      </div>
                    );
                  }

                  if (item.type === "engagement") {
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-chart-4/30 bg-chart-4/5 text-foreground text-xs"
                      >
                        <HelpCircle className="h-4 w-4 text-chart-4 shrink-0" />
                        <div>
                          <span className="font-bold text-chart-4 uppercase text-[10px] tracking-wider block">
                            Student Engagement Check
                          </span>
                          <span className="font-medium">{item.prompt}</span>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === "speech") {
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-background shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Volume2 className="h-3 w-3 text-primary" />
                            Segment {idx + 1}
                          </span>
                          <span className="font-mono text-[10px]">
                            {item.text.split(/\s+/).filter(Boolean).length} words
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                          {item.text}
                        </p>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>

          {/* Footer with Enter Classroom CTA */}
          <DialogFooter className="shrink-0 p-4 border-t border-black/5 dark:border-white/10 bg-muted/20 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-lg"
            >
              Close
            </Button>

            <Button
              size="sm"
              variant="default"
              asChild
              className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5"
            >
              <Link href={`/classroom/${session.id}`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Enter Lecture Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Script Confirm Alert */}
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
              onClick={handleDeleteScript}
              disabled={deleting}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Yes, Delete Script</span>
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={deleting} className="w-full mt-0 h-9">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
