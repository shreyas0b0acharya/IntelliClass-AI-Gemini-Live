"use client";

import { BookOpen, Sparkles, Radio, Pause, Loader2, CheckCircle2 } from "lucide-react";
import { AppButton } from "@/components/app";

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
  const percent = totalItems > 0 ? Math.min(100, Math.round(((currentIndex + 1) / totalItems) * 100)) : 0;
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isEnded = status === "ended";

  return (
    <div
      className={`w-full max-w-2xl mx-auto ${
        isShortLandscape ? "px-3 py-1 gap-1" : isCompact ? "px-3.5 py-1.5 gap-1.5" : "px-4 py-2 gap-1.5"
      } bg-white/85 dark:bg-[#1c1c1e]/85 backdrop-blur-2xl rounded-2xl border border-black/10 dark:border-white/10 shadow-xl text-foreground flex flex-col transition-all select-none`}
    >
      {/* Top Row: Activity Indicator & Script Button */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {isThinking ? (
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold text-[11px] animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="truncate">AI addressing question...</span>
            </div>
          ) : isRunning ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500 shrink-0" />
              <span className="truncate">
                {isShortLandscape
                  ? `Part ${currentIndex + 1}/${totalItems || 1} • ${percent}%`
                  : `Segment ${currentIndex + 1} of ${totalItems || 1} • ${percent}% Spoken`}
              </span>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-1.5 text-[#ff9500] dark:text-[#ff9f0a] font-semibold text-[11px]">
              <Pause className="h-3.5 w-3.5 shrink-0" />
              <span>Lecture Paused</span>
            </div>
          ) : isEnded ? (
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Complete ({totalItems} Segments)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#0071e3] dark:text-sky-400 font-semibold text-[11px]">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Standby • Ready to Begin</span>
            </div>
          )}
        </div>

        {/* View Script & Plan CTA (Role Gated: Only for Lecturers, Optionally Openable) */}
        {canEditCurriculum && (
          <AppButton
            size="xs"
            variant="outline"
            shape="pill"
            onClick={onOpenScript}
            className="h-6 sm:h-7 px-2.5 text-[11px] font-semibold text-foreground bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border-black/10 dark:border-white/15 shrink-0 shadow-none"
            leftIcon={<BookOpen className="h-3 w-3 text-[#0071e3]" />}
          >
            <span>{isCompact || isShortLandscape ? "Script" : "Curriculum Script"}</span>
          </AppButton>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-[#0071e3] via-sky-400 to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
