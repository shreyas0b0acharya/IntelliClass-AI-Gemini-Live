"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, RotateCcw, Radio, Loader2, Users, AlertTriangle } from "lucide-react";
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
        <Button
          onClick={() => handleAction("start", onStart)}
          disabled={actionLoading !== null}
          className="rounded-full gap-2 h-10 px-5 text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-colors"
        >
          {actionLoading === "start" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" />
          )}
          {status === "paused" ? "Resume Class" : "Start Broadcast"}
        </Button>
      )}

      {/* Pause */}
      {status === "running" && (
        <Button
          onClick={() => handleAction("pause", onPause)}
          disabled={actionLoading !== null}
          className="rounded-full gap-2 h-10 px-5 text-xs font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer transition-colors"
        >
          {actionLoading === "pause" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pause className="h-4 w-4" fill="currentColor" />
          )}
          Pause Class
        </Button>
      )}

      {/* End */}
      {status !== "created" && status !== "ended" && (
        <Button
          onClick={() => handleAction("end", onEnd)}
          disabled={actionLoading !== null}
          variant="destructive"
          className="rounded-full gap-2 h-10 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs transition-colors"
        >
          {actionLoading === "end" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          )}
          End Class
        </Button>
      )}

      {/* Restart */}
      {(status === "ended" || status === "paused") && (
        <Button
          onClick={() => handleAction("restart", onRestart)}
          disabled={actionLoading !== null}
          variant="ghost"
          size="icon"
          title="Restart from beginning"
          className="rounded-full h-10 w-10 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
        >
          {actionLoading === "restart" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
