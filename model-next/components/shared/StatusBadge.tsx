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
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chart-2/10 text-chart-2 dark:text-chart-2 border border-chart-2/20 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-chart-2" />
        </span>
        LIVE NOW
      </span>
    );
  }

  if (status === "paused") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chart-4/10 text-chart-4 dark:text-chart-4 border border-chart-4/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-chart-4" />
        PAUSED
      </span>
    );
  }

  if (status === "scheduled") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        SCHEDULED
      </span>
    );
  }

  if (status === "draft") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        DRAFT
      </span>
    );
  }

  if (status === "created" || status === "ready") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:text-primary border border-primary/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        READY
      </span>
    );
  }

  if (stoppedReason === "no_students_timeout") {
    return (
      <span
        title="Classroom auto-stopped because no students were present for 30s"
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-chart-4/10 text-chart-4 dark:text-chart-4 border border-chart-4/20 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-chart-4" />
        AUTO-STOPPED
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 text-muted-foreground border border-black/5 dark:border-white/10 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      ENDED
    </span>
  );
}
