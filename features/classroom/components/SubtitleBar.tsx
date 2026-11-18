"use client";

import { cn } from "@/lib/utils";

interface SubtitleBarProps {
  subtitle: string;
  isShortLandscape?: boolean;
}

export function SubtitleBar({ subtitle, isShortLandscape = false }: SubtitleBarProps) {
  if (!subtitle || !subtitle.trim()) return null;

  return (
    <div className="w-full max-w-2xl px-3 sm:px-4 pointer-events-none transition-all">
      <div
        className={cn(
          "rounded-2xl bg-white/90 dark:bg-card/90 text-foreground dark:text-foreground border border-black/10 dark:border-white/10 backdrop-blur-2xl text-center font-medium shadow-xl dark:shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200 overflow-y-auto leading-relaxed",
          isShortLandscape
            ? "p-2 text-xs max-h-16"
            : "p-3 sm:p-4 text-xs sm:text-sm max-h-28 sm:max-h-36"
        )}
      >
        {subtitle}
      </div>
    </div>
  );
}
