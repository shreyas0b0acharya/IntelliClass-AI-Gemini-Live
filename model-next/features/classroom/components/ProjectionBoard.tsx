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
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface ProjectionBoardProps {
  media: MediaItemDisplay | null;
  onClose?: () => void;
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

export function ProjectionBoard({ media, onClose }: ProjectionBoardProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!media) return null;
  const resolvedUrl = resolveMediaUrl(media.url);

  return (
    <>
      <div
        className={`absolute top-4 right-4 z-20 transition-all duration-300 ${
          isMinimized ? "w-44" : "w-72 sm:w-80 md:w-96"
        } rounded-3xl overflow-hidden border border-white/20 dark:border-white/10 bg-black/80 backdrop-blur-2xl shadow-2xl text-white`}
      >
        {/* Board Header */}
        <div className="p-3 px-4 border-b border-white/10 flex items-center justify-between bg-white/[0.05]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
              <Sparkles className="h-3.5 w-3.5 text-[#0071e3]" />
              <span className="truncate">{media.label || "Projected Slide"}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-[10px] font-mono px-1.5 transition-colors cursor-pointer"
              title={isMinimized ? "Expand Board" : "Minimize Board"}
            >
              {isMinimized ? "Expand" : "Min"}
            </button>

            <button
              onClick={() => setIsZoomed(true)}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Full Screen Zoom"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss Visual"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Board Display Canvas */}
        {!isMinimized && (
          <div
            onClick={() => setIsZoomed(true)}
            className="p-3 relative group cursor-pointer overflow-hidden bg-black/40 flex items-center justify-center max-h-64"
          >
            {media.type === "video" ? (
              <video
                src={resolvedUrl}
                autoPlay
                loop
                muted
                playsInline
                className="max-h-56 w-full object-contain rounded-2xl shadow-inner"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedUrl}
                alt={media.label || "Projected Diagram"}
                className="max-h-56 w-full object-contain rounded-2xl shadow-inner transition-transform group-hover:scale-105"
                loading="eager"
              />
            )}

            {/* Hover expand hint */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
              <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg">
                <Maximize2 className="h-3.5 w-3.5" /> Click to Zoom
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Full Zoom Modal */}
      {isZoomed && (
        <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
          <DialogContent className="max-w-4xl max-h-[90vh] rounded-3xl p-0 overflow-hidden border border-white/15 bg-black/95 text-white shadow-2xl flex flex-col">
            <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between">
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#0071e3]" />
                <span>{media.label || "Projected Visual Diagram"}</span>
              </DialogTitle>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl h-8 px-3 text-xs bg-white/10 hover:bg-white/20 border-white/10 text-white gap-1.5"
              >
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Full Asset</span>
                </a>
              </Button>
            </div>

            <div className="p-6 flex-1 flex items-center justify-center overflow-hidden bg-black">
              {media.type === "video" ? (
                <video
                  src={resolvedUrl}
                  autoPlay
                  controls
                  className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedUrl}
                  alt={media.label || "Projected Diagram"}
                  className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
