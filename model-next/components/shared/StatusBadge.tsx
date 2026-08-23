"use client";

import type { SessionStatus } from "@/lib/supabase/types";

interface StatusBadgeProps {
  status: SessionStatus | string;
  stoppedReason?: string;
  className?: string;
}

export function StatusBadge({ status, stoppedReason, className = "" }: StatusBadgeProps) {
  if (status === "running") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        LIVE NOW
      </span>
    );
  }

  if (status === "paused") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        PAUSED
      </span>
    );
  }

  if (status === "created") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        READY
      </span>
    );
  }

  if (stoppedReason === "no_students_timeout") {
    return (
      <span
        title="Classroom auto-stopped because no students were present for 30s"
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        AUTO-STOPPED
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/5 dark:bg-white/10 text-[#86868b] border border-black/5 dark:border-white/10 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#86868b]" />
      ENDED
    </span>
  );
}
