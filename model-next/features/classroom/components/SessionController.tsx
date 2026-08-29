"use client";

import { useState } from "react";
import { AppButton } from "@/components/app/AppButton";
import { Play, Pause, Square, RotateCcw, Radio, Users, AlertTriangle } from "lucide-react";
import type { SessionStateStatus } from "../types/classroom";

import { unlockAudioContext } from "@/components/LipSync/audioManager";

interface SessionControllerProps {
  status: SessionStateStatus;
  isLecturer: boolean;
  activeStudentCount?: number;
  emptyRoomCountdown?: number | null;
  stoppedReason?: string;
  onStart: () => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
  onRestart: () => void | Promise<void>;
}

export function SessionController({
  status,
  isLecturer,
  activeStudentCount = 0,
  emptyRoomCountdown = null,
  stoppedReason,
  onStart,
  onPause,
  onEnd,
  onRestart,
}: SessionControllerProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (name: string, fn: () => void | Promise<void>) => {
    try {
      unlockAudioContext();
    } catch {}

    setActionLoading(name);
    try {
      await fn();
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Student Read-Only View (Zero Playback Controls) ──────────────────────
  if (!isLecturer) {
    return (
      <div className="flex items-center gap-2.5">
        {/* Active Broadcast Status */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-xs ${
            status === "running"
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : status === "paused"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
              : status === "ended"
              ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-[#86868b]"
              : "bg-muted/40 border-border/50 text-muted-foreground"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              status === "running"
                ? "bg-red-500 animate-pulse"
                : status === "paused"
                ? "bg-amber-500"
                : "bg-muted-foreground/40"
            }`}
          />
          {status === "running" ? (
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Live Broadcast
            </span>
          ) : status === "paused" ? (
            "Lecture Paused"
          ) : status === "ended" ? (
            stoppedReason === "no_students_timeout" ? (
              "Classroom Auto-Stopped"
            ) : (
              "Class Completed"
            )
          ) : (
            "Classroom Standby"
          )}
        </div>

        {/* Live Student Counter */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">
          <Users className="h-3.5 w-3.5 text-[#0071e3]" />
          <span>{activeStudentCount} Online</span>
        </div>
      </div>
    );
  }

  // ─── Lecturer Full Control Suite ──────────────────────────────────────────
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* 30s Empty Room Timeout Warning Pill */}
      {emptyRoomCountdown !== null && status === "running" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Auto-stop in {emptyRoomCountdown}s (No students)</span>
        </div>
      )}

      {/* Active Student Count Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]">
        <Users className="h-3.5 w-3.5 text-[#0071e3]" />
        <span>{activeStudentCount} Students</span>
      </div>

      {/* Start / Resume */}
      {(status === "created" || status === "paused" || status === "ended") && (
        <AppButton
          onClick={() => handleAction("start", onStart)}
          disabled={actionLoading !== null}
          isLoading={actionLoading === "start"}
          variant="success"
          shape="pill"
          size="default"
          className="h-10 px-5 text-xs font-bold uppercase tracking-wider"
          leftIcon={actionLoading !== "start" ? <Play className="h-4 w-4" fill="currentColor" /> : undefined}
        >
          {status === "paused" ? "Resume Class" : "Start Broadcast"}
        </AppButton>
      )}

      {/* Pause */}
      {status === "running" && (
        <AppButton
          onClick={() => handleAction("pause", onPause)}
          disabled={actionLoading !== null}
          isLoading={actionLoading === "pause"}
          variant="secondary"
          shape="pill"
          size="default"
          className="h-10 px-5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-500 dark:hover:bg-amber-600"
          leftIcon={actionLoading !== "pause" ? <Pause className="h-4 w-4" fill="currentColor" /> : undefined}
        >
          Pause Class
        </AppButton>
      )}

      {/* End */}
      {status !== "created" && status !== "ended" && (
        <AppButton
          onClick={() => handleAction("end", onEnd)}
          disabled={actionLoading !== null}
          isLoading={actionLoading === "end"}
          variant="destructive"
          shape="pill"
          size="default"
          className="h-10 px-4 text-xs font-bold uppercase tracking-wider"
          leftIcon={actionLoading !== "end" ? <Square className="h-3.5 w-3.5" fill="currentColor" /> : undefined}
        >
          End Class
        </AppButton>
      )}

      {/* Restart */}
      {(status === "ended" || status === "paused") && (
        <AppButton
          onClick={() => handleAction("restart", onRestart)}
          disabled={actionLoading !== null}
          isLoading={actionLoading === "restart"}
          variant="ghost"
          size="icon"
          shape="pill"
          title="Restart from beginning"
          className="h-10 w-10 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
        </AppButton>
      )}
    </div>
  );
}
