"use client";

import { useState } from "react";
import type { MediaItemDisplay } from "../hooks/useClassroom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Maximize2,
  X,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectionBoardProps {
  media: MediaItemDisplay | null;
  onClose?: () => void;
  isCompact?: boolean;
  isShortLandscape?: boolean;
}

function resolveMediaUrl(url: string): string {
  if (!url) return url;
  const match = url.match(/course-files\/(.+)$/);
  if (match && match[1]) {
    const cleanPath = match[1].split("?")[0];
    return `/api/media/${cleanPath}`;
  }
  return url;
}

export function ProjectionBoard({
  media,
  onClose,
  isCompact = false,
  isShortLandscape = false,
}: ProjectionBoardProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!media) return null;
  const resolvedUrl = resolveMediaUrl(media.url);

  return (
    <>
      <div
        className={cn(
          "absolute top-3 sm:top-4 right-3 sm:right-4 z-20 transition-all duration-300 ease-out",
          isMinimized
            ? "w-44 sm:w-52"
            : isCompact
              ? "w-68 sm:w-76 max-w-[calc(100vw-1.5rem)]"
              : "w-72 sm:w-84 md:w-96",
          "rounded-2xl sm:rounded-3xl overflow-hidden",
          "border border-black/10 dark:border-white/10",
          "bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl shadow-2xl",
          "text-foreground select-none"
        )}
      >
        {/* Board Header */}
        <div className="p-2.5 sm:p-3 px-3 sm:px-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Slide</span>
            </div>
            <span
              className="truncate text-xs font-bold text-foreground leading-tight"
              title={media.label || "Projected Diagram"}
            >
              {media.label || "Projected Visual"}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
              title={isMinimized ? "Expand Visual Board" : "Minimize to PIP"}
            >
              {isMinimized ? "Expand" : "Min"}
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsZoomed(true)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
              title="Full Screen Inspection"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>

            {onClose && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClose}
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
                title="Dismiss Visual"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Board Display Canvas */}
        {!isMinimized ? (
          <div
            onClick={() => setIsZoomed(true)}
            className={cn(
              "p-2.5 sm:p-3 relative group cursor-pointer overflow-hidden flex items-center justify-center bg-black/5 dark:bg-black/30",
              isShortLandscape ? "max-h-48" : "max-h-60 sm:max-h-72"
            )}
          >
            {media.type === "video" ? (
              <video
                src={resolvedUrl}
                autoPlay
                loop
                muted
                playsInline
                className="max-h-52 sm:max-h-64 w-full object-contain rounded-xl sm:rounded-2xl shadow-xs"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedUrl}
                alt={media.label || "Projected Diagram"}
                className="max-h-52 sm:max-h-64 w-full object-contain rounded-xl sm:rounded-2xl shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            )}

            {/* Hover expand hint */}
            <div className="absolute inset-0 bg-black/20 dark:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md text-xs font-semibold text-foreground flex items-center gap-1.5 shadow-lg border border-black/10 dark:border-white/10">
                <Maximize2 className="h-3.5 w-3.5 text-[#0071e3]" /> Click to Inspect
              </span>
            </div>
          </div>
        ) : (
          /* Minimized PIP Thumbnail Strip */
          <div
            onClick={() => setIsMinimized(false)}
            className="p-2 flex items-center gap-2.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-8 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-black/10 dark:border-white/10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedUrl}
                alt={media.label || "Slide"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-foreground truncate">
                {media.label || "Slide"}
              </span>
              <span className="text-[9px] text-[#0071e3] font-medium">Click to expand</span>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Full Zoom Modal */}
      {isZoomed && (
        <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
          <DialogContent className="max-w-4xl max-h-[92vh] rounded-3xl p-0 overflow-hidden border border-black/10 dark:border-white/15 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl shadow-2xl flex flex-col text-foreground">
            <div className="p-4 px-6 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#0071e3]" />
                <span className="truncate max-w-lg">{media.label || "Projected Visual Diagram"}</span>
              </DialogTitle>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 border-black/10 dark:border-white/15 text-foreground rounded-full"
              >
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-[#0071e3]" />
                  <span>Open Full Asset</span>
                </a>
              </Button>
            </div>

            <div className="p-4 sm:p-6 flex-1 flex items-center justify-center overflow-hidden bg-black/95 rounded-b-3xl">
              {media.type === "video" ? (
                <video
                  src={resolvedUrl}
                  autoPlay
                  controls
                  className="max-w-full max-h-[74vh] object-contain rounded-2xl shadow-2xl"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedUrl}
                  alt={media.label || "Projected Diagram"}
                  className="max-w-full max-h-[74vh] object-contain rounded-2xl shadow-2xl"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
