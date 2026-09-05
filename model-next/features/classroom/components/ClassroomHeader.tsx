"use client";

import { useState } from "react";
import { AppButton } from "@/components/app";
import {
  ChevronLeft,
  Copy,
  Link2,
  Users,
  BookOpen,
  FileText,
  MoreHorizontal,
  Check,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Square,
  RotateCcw,
  Captions,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { SessionController } from "./SessionController";
import { VolumeControl } from "./VolumeControl";
import { ThemeToggle } from "@/components/shared";
import type { ClassroomCapabilities } from "../types/capabilities";
import type { SessionStateStatus } from "../types/classroom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClassroomHeaderProps {
  topic: string;
  meetingCode: string;
  courseId?: string;
  isLecturer: boolean;
  capabilities: ClassroomCapabilities;
  sessionStatus: SessionStateStatus;
  voiceId?: string;
  avatarModel: string;
  activeStudentCount?: number;
  emptyRoomCountdown?: number | null;
  stoppedReason?: string;
  participantsCount: number;
  hasWaitingStudents: boolean;
  scriptItemCount?: number;
  onLeaveClick: () => void;
  onOpenParticipants: () => void;
  onOpenScript: () => void;
  onOpenMaterials: () => void;
  onStartSession?: () => void | Promise<void>;
  onPauseSession?: () => void | Promise<void>;
  onEndSession?: () => void | Promise<void>;
  onRestartSession?: () => void | Promise<void>;
  isCompact?: boolean;
  showCaptions?: boolean;
  onToggleCaptions?: () => void;
  showProgressHUD?: boolean;
  onToggleProgressHUD?: () => void;
}

export function ClassroomHeader({
  topic,
  meetingCode,
  isLecturer,
  capabilities,
  sessionStatus,
  voiceId,
  avatarModel,
  activeStudentCount,
  emptyRoomCountdown,
  stoppedReason,
  participantsCount,
  hasWaitingStudents,
  scriptItemCount = 0,
  onLeaveClick,
  onOpenParticipants,
  onOpenScript,
  onOpenMaterials,
  onStartSession,
  onPauseSession,
  onEndSession,
  onRestartSession,
  isCompact = false,
  showCaptions = true,
  onToggleCaptions,
  showProgressHUD = true,
  onToggleProgressHUD,
}: ClassroomHeaderProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(meetingCode);
    setCopiedCode(true);
    toast.success(`Meeting code "${meetingCode}" copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/session/${encodeURIComponent(meetingCode)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Session link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isDrClara = avatarModel === "women-avatarsdk";
  const personaName = isDrClara ? "Dr. Clara" : "Prof. Arthur";

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-5 shrink-0 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl z-20 gap-2 sm:gap-3 w-full max-w-full overflow-hidden select-none">
      {/* ── Left: Course Navigation, Session Topic (Prominent), & Role Pill ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        <AppButton
          variant="outline"
          size="sm"
          shape="pill"
          onClick={onLeaveClick}
          className="h-8 sm:h-9 px-2 sm:px-2.5 text-xs font-semibold shrink-0 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 shadow-none text-foreground"
          leftIcon={<ChevronLeft className="h-4 w-4 text-[#0071e3]" />}
          title="Return to Course Space"
        >
          <span className="hidden xl:inline">Course Space</span>
        </AppButton>

        <div className="flex flex-col min-w-0 flex-1 justify-center overflow-hidden">
          {/* Main Topic Title - gets full width */}
          <h1
            className="text-xs sm:text-sm md:text-base font-bold text-foreground truncate leading-tight tracking-tight"
            title={topic}
          >
            {topic}
          </h1>

          {/* Secondary Subtitle Row: Role badge and persona details */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium truncate leading-tight mt-0.5">
            {isLecturer ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full shrink-0">
                <ShieldCheck className="h-2.5 w-2.5" />
                <span>Faculty</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                <GraduationCap className="h-2.5 w-2.5" />
                <span>Student</span>
              </span>
            )}

            <span className="text-muted-foreground/40 shrink-0">•</span>
            <span className="shrink-0 font-medium text-foreground/80">{personaName}</span>
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="hidden sm:inline truncate">Voice: {voiceId || "am_fenrir"}</span>
          </div>
        </div>
      </div>

      {/* ── Right: Lean Essential Controls (Leaves Full Width for Topic) ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
        {/* Participants Modal Button (Always accessible) */}
        {capabilities.canViewParticipants && (
          <AppButton
            variant="outline"
            size="sm"
            shape="pill"
            onClick={onOpenParticipants}
            className="relative h-8 sm:h-9 px-2.5 text-xs font-semibold border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 shadow-none shrink-0"
            title="Classroom Participants"
            leftIcon={<Users className="h-3.5 w-3.5 text-[#0071e3]" />}
          >
            <span className="font-mono text-xs font-bold text-foreground">
              {participantsCount}
            </span>
            {hasWaitingStudents && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
            )}
          </AppButton>
        )}

        {/* Session Conductor (Primary Playback Controls) */}
        <SessionController
          status={sessionStatus}
          isLecturer={isLecturer}
          activeStudentCount={activeStudentCount}
          emptyRoomCountdown={emptyRoomCountdown}
          stoppedReason={stoppedReason}
          onStart={onStartSession || (() => {})}
          onPause={onPauseSession || (() => {})}
          onEnd={onEndSession || (() => {})}
          onRestart={onRestartSession || (() => {})}
          isCompact={isCompact}
        />

        {/* ── Secondary Overflow Menu (Apple HIG Horizontal Ellipsis) ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton
              variant="outline"
              size="icon-sm"
              shape="pill"
              aria-label="More classroom actions"
              className="h-8 sm:h-9 w-8 sm:w-9 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 shadow-none shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </AppButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-68 sm:w-72 p-1.5 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl space-y-0.5">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2.5 py-1">
              Classroom Tools
            </DropdownMenuLabel>

            {/* Course Materials */}
            {capabilities.canViewMaterials && (
              <DropdownMenuItem onClick={onOpenMaterials} className="gap-2.5 py-2 cursor-pointer rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Course Materials</span>
                  <span className="text-[10px] text-muted-foreground">View textbooks & PDF documents</span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Curriculum Script (Lecturer only) */}
            {capabilities.canEditCurriculum && (
              <DropdownMenuItem onClick={onOpenScript} className="gap-2.5 py-2 cursor-pointer rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                <BookOpen className="h-4 w-4 text-[#0071e3] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Curriculum Script</span>
                  <span className="text-[10px] text-muted-foreground">{scriptItemCount} lecture segments</span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Session Links & Sharing */}
            {capabilities.canShareSession && (
              <>
                <DropdownMenuSeparator className="my-1 bg-black/5 dark:bg-white/10" />
                <DropdownMenuItem onClick={handleCopyCode} className="gap-2.5 py-2 cursor-pointer rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="h-4 w-4 text-[#0071e3] shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Copy Meeting Code</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{meetingCode}</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleCopyLink} className="gap-2.5 py-2 cursor-pointer rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Link2 className="h-4 w-4 text-[#0071e3] shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Copy Direct Invite Link</span>
                    <span className="text-[10px] text-muted-foreground">Share invite link with students</span>
                  </div>
                </DropdownMenuItem>
              </>
            )}

            {/* Lecturer Session Actions */}
            {isLecturer && (
              <>
                <DropdownMenuSeparator className="my-1 bg-black/5 dark:bg-white/10" />
                {(sessionStatus === "ended" || sessionStatus === "paused") && onRestartSession && (
                  <DropdownMenuItem onClick={onRestartSession} className="gap-2.5 py-2 cursor-pointer rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
                    <RotateCcw className="h-4 w-4 text-[#0071e3] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-foreground">Restart Broadcast</span>
                      <span className="text-[10px] text-muted-foreground">Rewind to start of lecture</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {sessionStatus !== "created" && sessionStatus !== "ended" && onEndSession && (
                  <DropdownMenuItem
                    onClick={onEndSession}
                    className="gap-2.5 py-2 cursor-pointer rounded-xl text-[#ff3b30] focus:text-[#ff3b30] focus:bg-red-500/10 dark:focus:bg-red-500/15"
                  >
                    <Square className="h-4 w-4 fill-current shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs">End Broadcast</span>
                      <span className="text-[10px] text-red-500/80">Conclude session for everyone</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* ── All Settings & Preferences Unified in One Section ── */}
            <DropdownMenuSeparator className="my-1 bg-black/5 dark:bg-white/10" />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2.5 py-1">
              Classroom Settings
            </DropdownMenuLabel>

            {/* Audio Volume Controller */}
            <VolumeControl variant="menu" />

            {/* Live Captions (CC) Toggle — Available to both Faculty & Students */}
            {onToggleCaptions && (
              <div
                className="px-2.5 py-2 flex items-center justify-between text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors select-none cursor-pointer"
                onClick={onToggleCaptions}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Captions className="h-4 w-4 text-[#0071e3] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Live Captions</span>
                    <span className="text-[10px] text-muted-foreground">
                      {showCaptions ? "Speech subtitles enabled" : "Subtitles turned off"}
                    </span>
                  </div>
                </div>

                {/* Apple HIG iOS Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCaptions}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCaptions?.();
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showCaptions ? "bg-[#34c759]" : "bg-black/20 dark:bg-white/20"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      showCaptions ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Script Progress HUD Toggle — Available for Lecturer */}
            {isLecturer && onToggleProgressHUD && (
              <div
                className="px-2.5 py-2 flex items-center justify-between text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors select-none cursor-pointer"
                onClick={onToggleProgressHUD}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Activity className="h-4 w-4 text-[#0071e3] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Progress HUD</span>
                    <span className="text-[10px] text-muted-foreground">
                      {showProgressHUD ? "Stage progress bar visible" : "Stage progress bar hidden"}
                    </span>
                  </div>
                </div>

                {/* Apple HIG iOS Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showProgressHUD}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleProgressHUD?.();
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showProgressHUD ? "bg-[#34c759]" : "bg-black/20 dark:bg-white/20"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      showProgressHUD ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Appearance / Theme Switcher (Apple HIG Inset Segmented Control) */}
            <div
              className="px-2.5 py-2 flex items-center justify-between text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Appearance</span>
                  <span className="text-[10px] text-muted-foreground">Light, dark, or system</span>
                </div>
              </div>
              <ThemeToggle variant="segmented" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
