"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hand,
  Captions,
  MessageSquare,
  Users,
  PhoneOff,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface GoogleMeetControlsProps {
  isLecturer: boolean;
  isMicActive: boolean;
  onToggleMic: () => void;
  isAudioMuted?: boolean;
  onToggleAudioMute?: () => void;
  showCaptions: boolean;
  onToggleCaptions: () => void;
  onOpenParticipants: () => void;
  onOpenScript?: () => void;
  onLeaveCall: () => void;
  participantsCount?: number;
  unreadMessagesCount?: number;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
}

export function GoogleMeetControls({
  isLecturer,
  isMicActive,
  onToggleMic,
  isAudioMuted = false,
  onToggleAudioMute,
  showCaptions,
  onToggleCaptions,
  onOpenParticipants,
  onOpenScript,
  onLeaveCall,
  participantsCount = 1,
  unreadMessagesCount = 0,
  onToggleChat,
  isChatOpen = false,
}: GoogleMeetControlsProps) {
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Global Google Meet Keyboard Shortcut: Ctrl + D (or Cmd + D) toggles microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onToggleMic();
        toast.info(isMicActive ? "Microphone muted (Ctrl+D)" : "Microphone unmuted (Ctrl+D)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleMic, isMicActive]);

  const handleToggleHand = useCallback(() => {
    setIsHandRaised((prev) => {
      const next = !prev;
      if (next) {
        toast.success("✋ Hand raised. The professor will call on you!");
      } else {
        toast.info("Hand lowered.");
      }
      return next;
    });
  }, []);

  return (
    <div className="w-full flex justify-center items-center pointer-events-auto select-none">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 rounded-full bg-black/75 dark:bg-black/85 backdrop-blur-2xl border border-white/15 shadow-2xl transition-all">
        {/* 1. Microphone Mute / Unmute (Google Meet circular button) */}
        <button
          type="button"
          onClick={onToggleMic}
          title={isMicActive ? "Turn off microphone (Ctrl+D)" : "Turn on microphone (Ctrl+D)"}
          className={cn(
            "relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer",
            isMicActive
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50"
              : "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20"
          )}
        >
          {isMicActive ? (
            <>
              <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20" />
              <Mic className="h-5 w-5" />
            </>
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </button>

        {/* 2. Speaker / Class Audio Output Toggle */}
        {onToggleAudioMute && (
          <button
            type="button"
            onClick={onToggleAudioMute}
            title={isAudioMuted ? "Unmute lecture audio" : "Mute lecture audio"}
            className={cn(
              "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer",
              isAudioMuted
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-white/90"
            )}
          >
            {isAudioMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        )}

        {/* 3. Live Captions (CC) Toggle */}
        <button
          type="button"
          onClick={onToggleCaptions}
          title={showCaptions ? "Turn off live captions" : "Turn on live captions"}
          className={cn(
            "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer",
            showCaptions
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-white/10 hover:bg-white/20 text-white/80"
          )}
        >
          <Captions className="h-5 w-5" />
        </button>

        {/* 4. Raise Hand Button (✋) */}
        {!isLecturer && (
          <button
            type="button"
            onClick={handleToggleHand}
            title={isHandRaised ? "Lower hand" : "Raise hand to speak"}
            className={cn(
              "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer",
              isHandRaised
                ? "bg-amber-400 hover:bg-amber-500 text-black font-bold shadow-lg shadow-amber-400/30 scale-105"
                : "bg-white/10 hover:bg-white/20 text-white/80"
            )}
          >
            <Hand className="h-5 w-5" />
          </button>
        )}

        {/* 5. Lecture Roadmap (Lecturer only) */}
        {isLecturer && onOpenScript && (
          <button
            type="button"
            onClick={onOpenScript}
            title="Lecture Roadmap"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/80 transition-all cursor-pointer"
          >
            <BookOpen className="h-5 w-5" />
          </button>
        )}

        {/* 6. In-Call Chat Messages Toggle */}
        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            title="In-call messages"
            className={cn(
              "relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer",
              isChatOpen
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-white/10 hover:bg-white/20 text-white/80"
            )}
          >
            <MessageSquare className="h-5 w-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        )}

        {/* 7. Participants / People List */}
        <button
          type="button"
          onClick={onOpenParticipants}
          title="Meeting participants"
          className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/80 transition-all cursor-pointer"
        >
          <Users className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono text-white">
            {participantsCount}
          </span>
        </button>

        {/* 8. Leave Call / End Broadcast Button (Google Meet Red Pill Button) */}
        <Button
          type="button"
          size="sm"
          onClick={onLeaveCall}
          className="h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all ml-1 cursor-pointer"
        >
          <PhoneOff className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">
            {isLecturer ? "End Broadcast" : "Leave Call"}
          </span>
        </Button>
      </div>
    </div>
  );
}
export default GoogleMeetControls;
