"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Sparkles,
  Loader2,
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  Lightbulb,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { SessionRoadmap } from "../types/roadmap";
import type { ClassroomSession } from "@/lib/supabase/types";
import { getTimeTag } from "../services/liveAudioPlayer";
import { cn } from "@/lib/utils";

export interface LectureScriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: unknown[];
  currentIndex?: number;
  topic: string;
  isLecturer: boolean;
  status?: string;
  rawScript?: string;
  sessionId?: string;
  meetingCode?: string;
  roadmap?: SessionRoadmap | null;
  currentTopicId?: string | null;
  initialViewMode?: string;
  lectureMode?: string;
  onGenerateRoadmap?: () => Promise<void>;
  onSelectTopic?: (topicId: string) => void;
  onSaveScript?: (newScript: string) => Promise<void>;
  onDeleteScript?: () => Promise<void>;
  onUpdated?: (updated: ClassroomSession) => void;
  onStartSession?: () => void;
}

export function LectureScriptModal({
  open,
  onOpenChange,
  topic,
  isLecturer,
  status = "created",
  sessionId,
  roadmap,
  currentTopicId,
  onGenerateRoadmap,
  onSelectTopic,
  onStartSession,
}: LectureScriptModalProps) {
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [fetchedRoadmap, setFetchedRoadmap] = useState<SessionRoadmap | null>(null);

  // Self-healing fallback: if modal opens and roadmap is empty, fetch immediately from backend
  useEffect(() => {
    if (open && sessionId && (!roadmap?.topics || roadmap.topics.length === 0)) {
      api.getClassroomSession(sessionId)
        .then((res) => {
          if (res?.session?.roadmap?.topics?.length) {
            setFetchedRoadmap(res.session.roadmap);
          }
        })
        .catch((err) => {
          console.warn("[LectureScriptModal] Failed to fetch session roadmap:", err);
        });
    }
  }, [open, sessionId, roadmap]);

  const activeRoadmap = (roadmap?.topics && roadmap.topics.length > 0)
    ? roadmap
    : (fetchedRoadmap?.topics && fetchedRoadmap.topics.length > 0)
    ? fetchedRoadmap
    : null;

  const topics = activeRoadmap?.topics || [];
  const activeTopicId = selectedTopicId || currentTopicId || topics[0]?.id;
  const activeTopic = topics.find((t) => t.id === activeTopicId) || topics[0];

  const totalMinutes = topics.reduce(
    (acc, t) => acc + (t.estimatedDurationMinutes || 6),
    0
  );

  const handleGenerateRoadmap = async () => {
    setIsGeneratingRoadmap(true);
    try {
      if (onGenerateRoadmap) {
        await onGenerateRoadmap();
      } else if (sessionId) {
        const res = await api.generateRoadmap(sessionId, { lectureTopic: topic });
        if (res?.roadmap) {
          toast.success("AI lecture roadmap generated successfully!");
        }
      }
    } catch (err) {
      console.error("Roadmap generation error:", err);
      toast.error("Failed to generate roadmap.");
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                    Gemini Live Lecture Roadmap
                  </DialogTitle>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Gemini Live
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-xl">
                  {topic || "Interactive Lecture"} • {topics.length} interactive topic{topics.length === 1 ? "" : "s"} • ~{totalMinutes || 30} mins total
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isLecturer && (status === "created" || status === "paused") && onStartSession && (
                <Button
                  size="sm"
                  onClick={() => {
                    console.log(
                      `${getTimeTag()} 🖱️ [START/RESUME BUTTON CLICKED] User clicked "${status === "paused" ? "Resume Broadcast" : "Start Live Broadcast"}" on LectureScriptModal`
                    );
                    onOpenChange(false);
                    onStartSession();
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 rounded-xl gap-2 shadow-sm"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{status === "paused" ? "Resume Broadcast" : "Start Live Broadcast"}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 gap-4">
          {/* Top Meta Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Roadmap Topics
              </div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {topics.length} Core Modules
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Delivery Engine
              </div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Gemini Live AI (Adaptive)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Estimated Duration
              </div>
              <div className="text-sm font-bold font-mono text-primary mt-0.5">
                ~{totalMinutes || 30} min
              </div>
            </div>
          </div>

          {/* Main Topics Container */}
          {topics.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/70 bg-card/20">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                No Topic Roadmap Generated
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                Generate a dynamic 4-to-8 topic lecture roadmap powered by Gemini AI to guide real-time classroom teaching.
              </p>
              <Button
                onClick={handleGenerateRoadmap}
                disabled={isGeneratingRoadmap}
                className="gap-2 rounded-xl"
              >
                {isGeneratingRoadmap ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>Generate AI Lecture Roadmap</span>
              </Button>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
              {/* Left Column: Topics List */}
              <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Lecture Topics ({topics.length})
                  </span>
                  {isLecturer && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleGenerateRoadmap}
                      disabled={isGeneratingRoadmap}
                      className="h-6 text-[11px] text-primary gap-1"
                    >
                      {isGeneratingRoadmap ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      <span>Regenerate</span>
                    </Button>
                  )}
                </div>

                {topics.map((t) => {
                  const isSelected = t.id === activeTopicId;
                  const isCurrent = t.id === currentTopicId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTopicId(t.id);
                        if (isLecturer && onSelectTopic) {
                          onSelectTopic(t.id);
                        }
                      }}
                      className={cn(
                        "p-3 rounded-2xl border text-left cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary/40 shadow-xs"
                          : "bg-card/50 border-border/50 hover:bg-muted/40 text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {t.order}. {t.title}
                        </span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-chart-2 bg-chart-2/10 px-1.5 py-0.5 rounded-full border border-chart-2/20">
                            <Radio className="h-2.5 w-2.5 animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.description}
                      </p>
                      <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                        ~{t.estimatedDurationMinutes || 6} mins
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Topic Details */}
              <div className="md:col-span-7 flex flex-col gap-3 overflow-y-auto p-4 rounded-2xl border border-border/50 bg-card/30">
                {activeTopic ? (
                  <>
                    <div className="border-b border-border/40 pb-3">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-primary">
                        Topic {activeTopic.order}
                      </div>
                      <h4 className="text-base font-bold text-foreground mt-0.5">
                        {activeTopic.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {activeTopic.description}
                      </p>
                    </div>

                    {activeTopic.learningObjectives && activeTopic.learningObjectives.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Learning Objectives
                        </div>
                        <ul className="space-y-1">
                          {activeTopic.learningObjectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {((activeTopic.suggestedAnalogies && activeTopic.suggestedAnalogies.length > 0) || ((activeTopic as any).pedagogicalAnalogies && (activeTopic as any).pedagogicalAnalogies.length > 0)) && (
                      <div className="space-y-1.5 pt-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          <span>Real-World Pedagogical Analogies</span>
                        </div>
                        <div className="space-y-2">
                          {(activeTopic.suggestedAnalogies || (activeTopic as any).pedagogicalAnalogies || []).map((analogy: string, i: number) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground leading-relaxed italic"
                            >
                              &ldquo;{analogy}&rdquo;
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                    Select a topic to inspect details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LectureScriptModal;
