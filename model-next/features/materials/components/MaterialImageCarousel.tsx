"use client";

import { useState, useRef } from "react";
import type { MediaAsset } from "@/lib/supabase/types";
import { Image as ImageIcon, ChevronLeft, ChevronRight, Maximize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MaterialImageCarouselProps {
  fileName: string;
  assets: MediaAsset[];
  onProjectToStage?: (media: { type: "image"; url: string; label: string }) => void;
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

export function MaterialImageCarousel({
  fileName,
  assets,
  onProjectToStage,
}: MaterialImageCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

  // Match assets that belong to this file (either label starts with file prefix or source matches)
  const baseName = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
  const matchedAssets = assets.filter((a) => {
    const labelLower = a.label?.toLowerCase() || "";
    return labelLower.includes(baseName) || a.label.toLowerCase().includes(fileName.toLowerCase());
  });

  if (matchedAssets.length === 0) {
    return null;
  }

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 240;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground dark:text-foreground">
          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <ImageIcon className="h-3 w-3" />
          </div>
          <span>Extracted Visuals &amp; Diagrams</span>
          <span className="text-xs font-mono font-bold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full text-muted-foreground">
            {matchedAssets.length}
          </span>
        </div>

        {matchedAssets.length > 2 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleScroll("left")}
 className="h-6 w-6 "
              title="Scroll left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleScroll("right")}
 className="h-6 w-6 "
              title="Scroll right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar snap-x snap-mandatory"
      >
        {matchedAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => setSelectedAsset(asset)}
            className="group relative flex-shrink-0 w-36 h-28 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 cursor-pointer snap-start transition-all hover:scale-[1.03] hover:shadow-md hover:border-primary/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveMediaUrl(asset.file_url)}
              alt={asset.label || "Extracted diagram"}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            {/* Hover overlay with zoom icon */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center">
                <Maximize2 className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Page / Caption Badge */}
            <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-xs font-medium text-white truncate">
              {asset.label?.split("—")[1]?.trim() || asset.label}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Lightbox Modal */}
      <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl">
          <div className="p-4 sm:p-5 px-6 border-b border-border/50 bg-card/40 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <DialogTitle className="text-base font-bold truncate">
                {selectedAsset?.label || "Visual Diagram Asset"}
              </DialogTitle>
            </div>
            {onProjectToStage && selectedAsset && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onProjectToStage({
                    type: "image",
                    url: resolveMediaUrl(selectedAsset.file_url),
                    label: selectedAsset.label || "Projected Diagram",
                  });
                  setSelectedAsset(null);
                }}
                className="h-8 shrink-0 inline-flex items-center gap-1.5 rounded-xl font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Project to Stage</span>
              </Button>
            )}
          </div>

          <div className="p-6 flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-black/90">
            {selectedAsset && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaUrl(selectedAsset.file_url)}
                alt={selectedAsset.label || "Diagram"}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>

          <div className="p-4 px-6 border-t border-border/50 bg-card/40 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span>Extracted from {fileName}</span>
            <span className="text-xs font-mono text-primary font-bold">RAG Visual Anchor</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
