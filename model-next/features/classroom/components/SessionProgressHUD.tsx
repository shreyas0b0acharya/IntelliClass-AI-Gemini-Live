"use client";

import { BookOpen, Sparkles, Radio, Pause, Loader2, CheckCircle2 } from "lucide-react";
import { AppButton } from "@/components/app/AppButton";

interface SessionProgressHUDProps {
  status: string;
  currentIndex: number;
  totalItems: number;
  currentSpeechText?: string;
  isThinking?: boolean;
  onOpenScript: () => void;
}

export function SessionProgressHUD({
  status,
  currentIndex,
  totalItems,
  currentSpeechText,
  isThinking,
  onOpenScript,
}: SessionProgressHUDProps) {
  const percent = totalItems > 0 ? Math.min(100, Math.round(((currentIndex + 1) / totalItems) * 100)) : 0;
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isEnded = status === "ended";

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2 bg-black/60 dark:bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-1.5 transition-all">
      {/* Top Row: Activity Indicator & Script Button */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {isThinking ? (
            <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[11px] animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>AI addressing student question...</span>
            </div>
          ) : isRunning ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              <span className="truncate">
                Segment {currentIndex + 1} of {totalItems || 1} &bull; {percent}% Spoken
              </span>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
              <Pause className="h-3.5 w-3.5" />
              <span>Lecture Paused by Lecturer</span>
            </div>
          ) : isEnded ? (
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Lesson Complete ({totalItems} Segments)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Standby &bull; Ready to Begin</span>
            </div>
          )}
        </div>

        {/* View Script & Plan CTA */}
        <AppButton
          size="xs"
          variant="glass"
          shape="rounded"
          onClick={onOpenScript}
          className="h-7 px-2.5 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border-white/15 shrink-0"
          leftIcon={<BookOpen className="h-3 w-3 text-[#0071e3]" />}
        >
          <span>View Curriculum Script</span>
        </AppButton>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#0071e3] via-sky-400 to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
