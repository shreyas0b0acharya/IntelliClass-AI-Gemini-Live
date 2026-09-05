"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  Settings2,
  Lock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { SessionController } from "./SessionController";
import { VolumeControl } from "./VolumeControl";
import { ThemeToggle } from "@/components/shared";
import { DEFAULT_MALE_VOICE_ID, DEFAULT_FEMALE_AVATAR_MODEL } from "@/config";
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
  speechSpeed?: number;
  onOpenPersonaConfig?: () => void;
  showCaptions?: boolean;
  onToggleCaptions?: () => void;
  showProgressHUD?: boolean;
  onToggleProgressHUD?: () => void;
  onOpenConfig?: () => void;
}

export function ClassroomHeader({
  topic,
  meetingCode,
  isLecturer,
  capabilities,
  sessionStatus,
  voiceId,
  avatarModel,
  speechSpeed,
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
  onOpenPersonaConfig,
  onStartSession,
  onPauseSession,
  onEndSession,
  onRestartSession,
  isCompact = false,
  showCaptions = true,
  onToggleCaptions,
  showProgressHUD = true,
  onToggleProgressHUD,
  onOpenConfig,
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

  const isDrClara = avatarModel === DEFAULT_FEMALE_AVATAR_MODEL;
  const personaName = isDrClara ? "Dr. Clara" : "Prof. Arthur";

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-5 shrink-0 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/80 backdrop-blur-2xl z-20 gap-2 sm:gap-3 w-full max-w-full overflow-hidden select-none">
      {/* ── Left: Course Navigation, Session Topic (Prominent), & Role Pill ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={onLeaveClick}
 className="h-8 sm:h-9 shrink-0 inline-flex items-center "
          title="Return to Course Space"
        >
          <ChevronLeft className="h-4 w-4 text-primary" />
          <span className="hidden xl:inline">Course Space</span>
        </Button>

        <div className="flex flex-col min-w-0 flex-1 justify-center overflow-hidden">
          {/* Main Topic Title - gets full width */}
          <h1
            className="text-xs sm:text-sm md:text-base font-bold text-foreground truncate leading-tight tracking-tight"
            title={topic}
          >
            {topic}
          </h1>

          {/* Secondary Subtitle Row: Role badge and persona details */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate leading-tight mt-0.5">
            {isLecturer ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary dark:text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full shrink-0">
                <ShieldCheck className="h-2.5 w-2.5" />
                <span>Faculty</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-chart-2 dark:text-chart-2 bg-chart-2/10 border border-chart-2/20 px-2 py-0.5 rounded-full shrink-0">
                <GraduationCap className="h-2.5 w-2.5" />
                <span>Student</span>
              </span>
            )}

            <span className="text-muted-foreground/40 shrink-0">•</span>
            <span className="shrink-0 font-medium text-foreground/80">{personaName}</span>
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="hidden sm:inline truncate">Voice: {voiceId || DEFAULT_MALE_VOICE_ID}</span>
          </div>
        </div>
      </div>

      {/* ── Right: Lean Essential Controls (Leaves Full Width for Topic) ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
        {/* Participants Modal Button (Always accessible) */}
        {capabilities.canViewParticipants && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenParticipants}
 className="relative h-8 sm:h-9 shrink-0 inline-flex items-center "
            title="Classroom Participants"
          >
            <Users className="h-3.5 w-3.5 text-primary" />
 <span className="font-mono font-bold text-foreground">
              {participantsCount}
            </span>
            {hasWaitingStudents && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-chart-4 ring-2 ring-background animate-pulse" />
            )}
          </Button>
        )}

        {/* Pre-Class Persona & Voice Setup (Visible to Lecturer) */}
        {isLecturer && (onOpenPersonaConfig || onOpenConfig) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPersonaConfig || onOpenConfig}
            className="h-8 sm:h-9 px-2.5 text-xs font-semibold shrink-0 gap-1.5"
            title={sessionStatus !== "running" ? "Configure Avatar Persona & Voice" : "View Persona & Audio Settings (Locked while broadcasting)"}
          >
            <User className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline text-xs">{personaName}</span>
            {sessionStatus === "running" && (
              <span className="text-[9px] px-1 py-0.2 rounded-md bg-muted text-muted-foreground font-mono">🔒</span>
            )}
          </Button>
        )}

        {/* Session Conductor (Primary Playback Controls) */}
        <SessionController
          status={sessionStatus}
          isLecturer={isLecturer}
          activeStudentCount={activeStudentCount}
          emptyRoomCountdown={emptyRoomCountdown}
          stoppedReason={stoppedReason}
          onStart={onStartSession || (() => { })}
          onPause={onPauseSession || (() => { })}
          onEnd={onEndSession || (() => { })}
          onRestart={onRestartSession || (() => { })}
          isCompact={isCompact}
        />

        {/* ── Secondary Overflow Menu (Apple HIG Horizontal Ellipsis) ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="More classroom actions"
 className="h-8 sm:h-9 w-8 sm:w-9 shrink-0 "
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

 <DropdownMenuContent align="end" className="w-68 sm:w-72 ">
 <DropdownMenuLabel className="">
              Classroom Tools
            </DropdownMenuLabel>

            {/* Persona & Audio Configuration */}
            {isLecturer && (onOpenPersonaConfig || onOpenConfig) && (
              <DropdownMenuItem
                onClick={onOpenPersonaConfig || onOpenConfig}
                className="gap-2.5 py-2 cursor-pointer rounded-xl"
              >
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-foreground">Avatar Persona & Voice</span>
                    {sessionStatus === "running" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-chart-4/10 text-chart-4 font-bold">
                        Locked (Live)
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {personaName} • {voiceId || DEFAULT_MALE_VOICE_ID} {speechSpeed ? `(${speechSpeed.toFixed(2)}x)` : ""}
                  </span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Course Materials */}
            {capabilities.canViewMaterials && (
 <DropdownMenuItem onClick={onOpenMaterials} className=" cursor-pointer ">
                <FileText className="h-4 w-4 text-chart-2 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Course Materials</span>
                  <span className="text-xs text-muted-foreground">View textbooks & PDF documents</span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Curriculum Script (Lecturer only) */}
            {capabilities.canEditCurriculum && (
 <DropdownMenuItem onClick={onOpenScript} className=" cursor-pointer ">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Curriculum Script</span>
                  <span className="text-xs text-muted-foreground">{scriptItemCount} lecture segments</span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Session Links & Sharing */}
            {capabilities.canShareSession && (
              <>
 <DropdownMenuSeparator className="my-1 " />
 <DropdownMenuItem onClick={handleCopyCode} className=" cursor-pointer ">
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-chart-2 shrink-0" />
                  ) : (
                    <Copy className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Copy Meeting Code</span>
                    <span className="font-mono text-xs text-muted-foreground">{meetingCode}</span>
                  </div>
                </DropdownMenuItem>

 <DropdownMenuItem onClick={handleCopyLink} className=" cursor-pointer ">
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-chart-2 shrink-0" />
                  ) : (
                    <Link2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Copy Direct Invite Link</span>
                    <span className="text-xs text-muted-foreground">Share invite link with students</span>
                  </div>
                </DropdownMenuItem>
              </>
            )}

            {/* Lecturer Session Actions */}
            {isLecturer && (
              <>
 <DropdownMenuSeparator className="my-1 " />
                {(sessionStatus === "ended" || sessionStatus === "paused") && onRestartSession && (
 <DropdownMenuItem onClick={onRestartSession} className=" cursor-pointer ">
                    <RotateCcw className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-foreground">Restart Broadcast</span>
                      <span className="text-xs text-muted-foreground">Rewind to start of lecture</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {sessionStatus !== "created" && sessionStatus !== "ended" && onEndSession && (
                  <DropdownMenuItem
                    onClick={onEndSession}
 className=" cursor-pointer "
                  >
                    <Square className="h-4 w-4 fill-current shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs">End Broadcast</span>
                      <span className="text-xs text-destructive/80">Conclude session for everyone</span>
                    </div>
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* ── All Settings & Preferences Unified in One Section ── */}
 <DropdownMenuSeparator className="my-1 " />
 <DropdownMenuLabel className="">
              Classroom Settings
            </DropdownMenuLabel>

            {/* AI Lecturer & Voice Configuration (Lecturer only, locked while live) */}
            {isLecturer && onOpenConfig && (() => {
              const configLocked = sessionStatus === "running" || sessionStatus === "paused";
              return (
                <DropdownMenuItem
                  disabled={configLocked}
                  onClick={configLocked ? undefined : onOpenConfig}
                  className="cursor-pointer"
                >
                  <Settings2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-xs text-foreground">AI Lecturer &amp; Voice</span>
                    <span className="text-xs text-muted-foreground">
                      {configLocked
                        ? "Locked while broadcast is live"
                        : `${personaName} · ${voiceId || "am_fenrir"}`}
                    </span>
                  </div>
                  {configLocked && (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })()}

            {/* Audio Volume Controller */}
            <VolumeControl variant="menu" />

            {/* Live Captions (CC) Toggle — Available to both Faculty & Students */}
            {onToggleCaptions && (
              <div
                className="px-2.5 py-2 flex items-center justify-between text-xs rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors select-none cursor-pointer"
                onClick={onToggleCaptions}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Captions className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Live Captions</span>
                    <span className="text-xs text-muted-foreground">
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
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showCaptions ? "bg-chart-2" : "bg-black/20 dark:bg-white/20"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${showCaptions ? "translate-x-4" : "translate-x-0"
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
                  <Activity className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground">Progress HUD</span>
                    <span className="text-xs text-muted-foreground">
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
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showProgressHUD ? "bg-chart-2" : "bg-black/20 dark:bg-white/20"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${showProgressHUD ? "translate-x-4" : "translate-x-0"
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
                <Sparkles className="h-4 w-4 text-chart-4 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-foreground">Appearance</span>
                  <span className="text-xs text-muted-foreground">Light, dark, or system</span>
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
