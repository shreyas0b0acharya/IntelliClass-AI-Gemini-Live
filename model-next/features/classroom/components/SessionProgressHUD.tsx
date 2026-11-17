"use client";

import { BookOpen, Sparkles, Radio, Pause, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClassroomStore } from "../store/classroomStore";

interface SessionProgressHUDProps {
  status: string;
  currentIndex: number;
  totalItems: number;
  currentSpeechText?: string;
  isThinking?: boolean;
  onOpenScript: () => void;
  canEditCurriculum?: boolean;
  isCompact?: boolean;
  isShortLandscape?: boolean;
}

export function SessionProgressHUD({
  status,
  currentIndex,
  totalItems,
  currentSpeechText: _currentSpeechText,
  isThinking,
  onOpenScript,
  canEditCurriculum = false,
  isCompact = false,
  isShortLandscape = false,
}: SessionProgressHUDProps) {
  const roadmap = useClassroomStore((s) => s.roadmap);
  const currentTopicId = useClassroomStore((s) => s.currentTopicId);

  const activeTopic = roadmap?.topics?.find((t) => t.id === currentTopicId) || roadmap?.topics?.[0];
  const topicCount = roadmap?.topics?.length || 0;

  const percent =
    roadmap && topicCount > 0 && activeTopic
      ? Math.min(100, Math.round((activeTopic.order / topicCount) * 100))
      : totalItems > 0
      ? Math.min(100, Math.round(((currentIndex + 1) / totalItems) * 100))
      : 0;

  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isEnded = status === "ended";

  return (
    <div
      className={`w-full max-w-2xl mx-auto ${
        isShortLandscape ? "px-3 py-1 gap-1" : isCompact ? "px-3.5 py-1.5 gap-1.5" : "px-4 py-2 gap-1.5"
      } bg-white/85 dark:bg-card/85 backdrop-blur-2xl rounded-2xl border border-black/10 dark:border-white/10 shadow-xl text-foreground flex flex-col transition-all select-none`}
    >
      {/* Top Row: Activity Indicator & Script Button */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {isThinking ? (
            <div className="flex items-center gap-1.5 text-chart-5 dark:text-chart-5 font-semibold text-xs animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="truncate">AI addressing question...</span>
            </div>
          ) : isRunning ? (
            roadmap && activeTopic ? (
              <div className="flex items-center gap-1.5 text-chart-2 dark:text-chart-2 font-semibold text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse text-chart-2 shrink-0" />
                <span className="truncate">
                  {isShortLandscape
                    ? `T${activeTopic.order}/${topicCount}: ${activeTopic.title}`
                    : `Topic ${activeTopic.order} of ${topicCount}: "${activeTopic.title}" • Gemini Live`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-chart-2 dark:text-chart-2 font-semibold text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse text-chart-2 shrink-0" />
                <span className="truncate">
                  Live Classroom Broadcast • Gemini Live AI
                </span>
              </div>
            )
          ) : isPaused ? (
            <div className="flex items-center gap-1.5 text-chart-4 dark:text-chart-4 font-semibold text-xs">
              <Pause className="h-3.5 w-3.5 shrink-0" />
              <span>Lecture Paused</span>
            </div>
          ) : isEnded ? (
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-chart-2 shrink-0" />
              <span>
                Complete ({topicCount > 0 ? `${topicCount} Topics` : "Gemini Live Lecture"})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-primary dark:text-primary font-semibold text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>
                {topicCount > 0
                  ? `Live AI Roadmap • ${topicCount} Topics Ready`
                  : "Gemini Live • Ready to Broadcast"}
              </span>
            </div>
          )}
        </div>

        {/* View Roadmap CTA (Role Gated: Only for Lecturers, Optionally Openable) */}
        {canEditCurriculum && (
          <Button
            size="xs"
            variant="outline"
            onClick={onOpenScript}
            className="h-6 sm:h-7 shrink-0 inline-flex items-center "
          >
            <BookOpen className="h-3 w-3 text-primary" />
            <span>Roadmap</span>
          </Button>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative">
        <div
          className="h-full w-[var(--hud-progress)] bg-gradient-to-r from-primary via-primary to-chart-2 rounded-full transition-all duration-500 ease-out"
          style={{ "--hud-progress": `${percent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
