"use client";

import { useState } from "react";
import type { LectureItem } from "../types/lecture-item";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";

interface LectureScriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LectureItem[];
  currentIndex: number;
  topic: string;
  isLecturer: boolean;
  status: string;
  rawScript?: string;
  onSaveScript?: (newScript: string) => Promise<void>;
  onStartSession?: () => void;
}

export function LectureScriptModal({
  open,
  onOpenChange,
  items,
  currentIndex,
  topic,
  isLecturer,
  status,
  rawScript = "",
  onSaveScript,
  onStartSession,
}: LectureScriptModalProps) {
  const [viewMode, setViewMode] = useState<"cards" | "edit">("cards");
  const [editedScript, setEditedScript] = useState<string>(rawScript);
  const [isSaving, setIsSaving] = useState(false);

  const speechCount = items.filter((i) => i.type === "speech").length;
  const totalWords = items
    .filter((i) => i.type === "speech")
    .reduce((acc, i) => acc + (i.type === "speech" ? i.text.split(" ").length : 0), 0);
  const estDurationMin = Math.max(1, Math.round(totalWords / 130));

  const handleSave = async () => {
    if (!onSaveScript) return;
    setIsSaving(true);
    try {
      await onSaveScript(editedScript);
      setViewMode("cards");
    } catch {
      toast.error("Failed to save edited script.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
 <DialogHeader className=" shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
 <DialogTitle className="">
                  Curriculum &amp; Lecture Script
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                  {topic} &bull; {items.length} segments &bull; ~{estDurationMin} mins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLecturer && onSaveScript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (viewMode === "cards") {
                      setEditedScript(rawScript || items.map((i) => (i.type === "speech" ? i.text : `[${i.type.toUpperCase()}]`)).join(" "));
                      setViewMode("edit");
                    } else {
                      setViewMode("cards");
                    }
                  }}
 className="h-8 inline-flex items-center "
                >
                  {viewMode === "cards" ? <Edit3 className="h-3.5 w-3.5 text-primary" /> : <List className="h-3.5 w-3.5" />}
                  <span>{viewMode === "cards" ? "Edit Script" : "Segment View"}</span>
                </Button>
              )}

              {isLecturer && (status === "created" || status === "paused") && onStartSession && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    onOpenChange(false);
                    onStartSession();
                  }}
                  disabled={items.length === 0}
 className=" h-8 inline-flex items-center "
                >
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                  <span>{status === "paused" ? "Resume Class" : "Start Live Broadcast"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5 text-center">
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03]">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                Speech Segments
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {speechCount} Sentences
              </span>
            </div>
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03]">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                Word Count
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {totalWords} Words
              </span>
            </div>
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03]">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                Live Progress
              </span>
              <span className="text-xs font-mono font-bold text-primary">
                {items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0}% Complete
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="p-6 pt-3 flex-1 overflow-y-auto space-y-3">
          {viewMode === "edit" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Fine-tune the lecture script below. Insert <code className="text-primary font-bold">[PAUSE]</code> for pauses or <code className="text-chart-4 font-bold">[ENGAGEMENT]</code> for rhetorical questions.
              </p>
              <Textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                rows={14}
 className="w-full resize-none "
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode("cards")}
 className="h-8 "
                >
                  <span>Cancel</span>
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSave}
                  disabled={isSaving}
 className="h-8 inline-flex items-center "
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
          ) : items.length === 0 ? (
            <div className="p-8 text-center space-y-2 border border-dashed border-black/10 dark:border-white/10 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01]">
              <p className="text-sm font-bold text-foreground">No script generated yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate the lecture script from course syllabus materials or edit the script text directly before starting the broadcast.
              </p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isCurrent = idx === currentIndex && status === "running";
              const isCompleted = idx < currentIndex;

              if (item.type === "speech") {
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${isCurrent
                        ? "bg-primary/10 border-primary/40 ring-1 ring-ring/40 shadow-sm"
                        : isCompleted
                          ? "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70"
                          : "bg-white dark:bg-muted border-black/5 dark:border-white/10"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <Volume2 className="h-3 w-3" />
                          Speech Segment
                        </span>
                      </div>

                      {isCurrent ? (
                        <span className="text-xs font-bold text-chart-2 dark:text-chart-2 bg-chart-2/15 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <Sparkles className="h-2.5 w-2.5" />
                          NOW SPEAKING
                        </span>
                      ) : isCompleted ? (
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-chart-2" /> Spoken
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={`text-xs leading-relaxed font-medium ${isCurrent
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground"
                        }`}
                    >
                      {item.text}
                    </p>
                  </div>
                );
              }

              if (item.type === "pause") {
                return (
                  <div
                    key={item.id}
                    className="px-4 py-2 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Clock className="h-3 w-3 text-chart-4" />
                    <span>Pause &bull; {item.durationMs || 1200}ms pause for student comprehension</span>
                  </div>
                );
              }

              if (item.type === "engagement") {
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-chart-4/10 border border-chart-4/20 text-xs text-chart-4 dark:text-chart-4 flex items-start gap-2.5"
                  >
                    <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs uppercase tracking-wider">
                        Engagement Checkpoint
                      </p>
                      <p className="text-xs text-foreground mt-0.5">
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
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${isCurrent
                        ? "bg-chart-5/15 border-chart-5/40 ring-1 ring-chart-5/40 shadow-sm"
                        : "bg-chart-5/5 dark:bg-chart-5/10 border-chart-5/20"
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-10 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-black/10 dark:border-white/10 flex items-center justify-center">
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
                          className="text-xs font-semibold text-foreground truncate max-w-sm mt-0.5"
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
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
