"use client";

import { SessionProgressHUD } from "./SessionProgressHUD";
import { ProjectionBoard } from "./ProjectionBoard";
import { SubtitleBar } from "./SubtitleBar";
import { QuestionInput } from "./QuestionInput";
import type { MediaItemDisplay } from "../hooks/useClassroom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface StageOverlayProps {
  // HUD
  sessionStatus: string;
  currentIndex: number;
  totalItems: number;
  currentSpeechText?: string;
  isThinking?: boolean;
  onOpenScript?: () => void;
  canEditCurriculum?: boolean;
  showProgressHUD?: boolean;

  // Projection Visual Board
  activeMedia?: MediaItemDisplay | null;
  onCloseMedia?: () => void;

  // Subtitle
  subtitle?: string;
  showCaptions?: boolean;

  // Doubt Bar
  canAskDoubt?: boolean;
  userQuestion?: string;
  canSpeak?: boolean;
  isMicActive?: boolean;
  onToggleMic?: () => void;
  onQuestionChange?: (val: string) => void;
  onQuestionSubmit?: (e?: React.FormEvent) => void;

  // Responsive Layout
  isCompact?: boolean;
  isShortLandscape?: boolean;
}

export function StageOverlay({
  sessionStatus,
  currentIndex,
  totalItems,
  currentSpeechText,
  isThinking = false,
  onOpenScript,
  canEditCurriculum = false,
  showProgressHUD = true,
  activeMedia = null,
  onCloseMedia,
  subtitle,
  showCaptions = true,
  canAskDoubt = true,
  userQuestion = "",
  canSpeak = false,
  isMicActive = false,
  onToggleMic,
  onQuestionChange,
  onQuestionSubmit,
  isCompact = false,
  isShortLandscape = false,
}: StageOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 sm:p-4 overflow-hidden select-none">
      {/* ── Top HUD Layer: Only for Lecturers when enabled ── */}
      {canEditCurriculum && showProgressHUD ? (
        <div className="w-full flex justify-center px-1 sm:px-4 pointer-events-auto animate-in fade-in-0 duration-200">
          <SessionProgressHUD
            status={sessionStatus}
            currentIndex={currentIndex}
            totalItems={totalItems}
            currentSpeechText={currentSpeechText}
            isThinking={isThinking}
            onOpenScript={onOpenScript || (() => {})}
            canEditCurriculum={canEditCurriculum}
            isCompact={isCompact}
            isShortLandscape={isShortLandscape}
          />
        </div>
      ) : isThinking ? (
        /* Subtle Floating Thinking Pill for Students (Zero script clutter) */
        <div className="w-full flex justify-center px-1 sm:px-4 pointer-events-none animate-in fade-in-0 duration-200">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/85 dark:bg-card/85 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-lg text-xs font-semibold text-chart-5 dark:text-chart-5 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>AI addressing question...</span>
          </div>
        </div>
      ) : (
        <div className="h-0" />
      )}

      {/* ── Projection Board (Active Visual Slide / Diagram) ── */}
      {activeMedia && (
        <div className="pointer-events-auto">
          <ProjectionBoard
            media={activeMedia}
            onClose={onCloseMedia}
            isCompact={isCompact}
            isShortLandscape={isShortLandscape}
          />
        </div>
      )}

      {/* ── Bottom Information & Interaction Cluster ── */}
      <div
        className={cn(
          "w-full flex flex-col items-center gap-2 pointer-events-none transition-all",
          isShortLandscape ? "pb-1" : "pb-2"
        )}
      >
        {/* Subtitles Overlay (Optionally togglable for both roles) */}
        {showCaptions && subtitle && (
          <div className="w-full flex justify-center">
            <SubtitleBar subtitle={subtitle} isShortLandscape={isShortLandscape} />
          </div>
        )}

        {/* Question / Interruption Bar (Role Gated: Only for Students) */}
        {canAskDoubt && onQuestionChange && onQuestionSubmit && (
          <div className="w-full max-w-xl flex justify-center pointer-events-auto">
            <QuestionInput
              question={userQuestion}
              isThinking={isThinking}
              disabled={sessionStatus !== "running"}
              canSpeak={canSpeak}
              isMicActive={isMicActive}
              onToggleMic={onToggleMic}
              onQuestionChange={onQuestionChange}
              onSubmit={onQuestionSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
