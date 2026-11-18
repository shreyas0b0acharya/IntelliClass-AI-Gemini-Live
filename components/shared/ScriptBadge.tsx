"use client";

import { FileText } from "lucide-react";

interface ScriptBadgeProps {
  script?: string | null;
  onClick?: () => void;
  className?: string;
  isLecturer?: boolean;
}

export function ScriptBadge({
  script,
  onClick,
  className = "",
  isLecturer = true,
}: ScriptBadgeProps) {
  const hasScript = Boolean(script && script.trim().length > 0);
  const wordCount = hasScript ? script!.split(/\s+/).filter(Boolean).length : 0;

  if (hasScript) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-md transition-colors ${
          onClick ? "cursor-pointer" : "cursor-default"
        } ${className}`}
        title="View, edit, or copy lecture script"
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span>Script Ready ({wordCount}w)</span>
      </button>
    );
  }

  if (isLecturer) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md transition-colors ${
          onClick ? "cursor-pointer" : "cursor-default"
        } ${className}`}
        title="Click to add or paste a lecture script"
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span>No Script</span>
      </button>
    );
  }

  return null;
}

