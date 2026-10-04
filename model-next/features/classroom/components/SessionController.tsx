"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Radio, AlertTriangle, Loader2 } from "lucide-react";
import type { SessionStateStatus } from "../types/classroom";
import { unlockAudioContext } from "@/features/avatar";

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
  isCompact?: boolean;
}

export function SessionController({
  status,
  isLecturer,
  emptyRoomCountdown = null,
  stoppedReason: _stoppedReason,
  onStart,
  onPause,
  onEnd,
  isCompact = false,
}: SessionControllerProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (name: string, fn: () => void | Promise<void>) => {
    try {
      unlockAudioContext();
    } catch { }

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
      <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
        {/* Active Broadcast Status Badge (Apple HIG Capsule) */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border shadow-xs ${status === "running"
              ? "bg-red-500/10 border-red-500/25 text-[#ff3b30] dark:text-[#ff453a]"
              : status === "paused"
                ? "bg-amber-500/10 border-amber-500/25 text-[#ff9500] dark:text-[#ff9f0a]"
                : status === "ended"
                  ? "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/10 text-muted-foreground"
                  : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-muted-foreground"
            }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${status === "running"
                ? "bg-[#ff3b30] animate-pulse"
                : status === "paused"
                  ? "bg-[#ff9500]"
                  : "bg-muted-foreground/40"
              }`}
          />
          {status === "running" ? (
            <span className="flex items-center gap-1">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>Live</span>
            </span>
          ) : status === "paused" ? (
            <span>Paused</span>
          ) : status === "ended" ? (
            <span>Ended</span>
          ) : (
            <span>Standby</span>
          )}
        </div>
      </div>
    );
  }

  // ─── Lecturer Full Control Suite (Adaptive & Mobile-Friendly) ─────────────
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
      {/* 30s Empty Room Timeout Warning Pill */}
      {emptyRoomCountdown !== null && status === "running" && (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{isCompact ? `${emptyRoomCountdown}s` : `Auto-stop in ${emptyRoomCountdown}s`}</span>
        </div>
      )}

      {/* Start / Resume Action Button */}
      {(status === "created" || status === "paused" || status === "ended") && (
        <Button
          onClick={() => handleAction("start", onStart)}
          disabled={actionLoading !== null}
          variant="default"
          size="sm"
          className="h-8 sm:h-9 px-3 sm:px-4 text-xs font-semibold bg-[#34c759] hover:bg-[#30b34e] text-white shadow-xs shrink-0 rounded-full inline-flex items-center gap-1.5"
        >
          {actionLoading === "start" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          )}
          <span>
            {isCompact
              ? status === "paused"
                ? "Resume"
                : "Start"
              : status === "paused"
                ? "Resume Class"
                : "Start Broadcast"}
          </span>
        </Button>
      )}

      {/* Pause Action Button */}
      {status === "running" && (
        <Button
          onClick={() => handleAction("pause", onPause)}
          disabled={actionLoading !== null}
          variant="secondary"
          size="sm"
          className="h-8 sm:h-9 px-3 sm:px-4 text-xs font-semibold bg-[#ff9500] hover:bg-[#e08500] text-white shadow-xs shrink-0 rounded-full inline-flex items-center gap-1.5"
        >
          {actionLoading === "pause" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          )}
          <span>{isCompact ? "Pause" : "Pause Class"}</span>
        </Button>
      )}

      {/* End Lecture Button (Desktop only; on compact, safely accessible via overflow menu) */}
      {status !== "created" && status !== "ended" && !isCompact && (
        <Button
          onClick={() => handleAction("end", onEnd)}
          disabled={actionLoading !== null}
          variant="destructive"
          size="sm"
          className="h-8 sm:h-9 px-3 text-xs font-semibold bg-[#ff3b30] hover:bg-[#e0342a] text-white shadow-xs shrink-0 rounded-full inline-flex items-center gap-1.5"
        >
          {actionLoading === "end" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          )}
          <span>End Class</span>
        </Button>
      )}
    </div>
  );
}
