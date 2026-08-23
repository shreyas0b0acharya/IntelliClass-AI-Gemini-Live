"use client";

import { useState, useRef } from "react";
import type { MediaAsset } from "@/lib/supabase/types";
import { Image as ImageIcon, ChevronLeft, ChevronRight, Maximize2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MaterialImageCarouselProps {
  fileName: string;
  assets: MediaAsset[];
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

export function MaterialImageCarousel({ fileName, assets }: MaterialImageCarouselProps) {
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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
          <div className="w-5 h-5 rounded-md bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
            <ImageIcon className="h-3 w-3" />
          </div>
          <span>Extracted Visuals &amp; Diagrams</span>
          <span className="text-[10px] font-mono font-bold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full text-[#86868b]">
            {matchedAssets.length}
          </span>
        </div>

        {matchedAssets.length > 2 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll("left")}
              className="h-6 w-6 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#86868b]"
              title="Scroll left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleScroll("right")}
              className="h-6 w-6 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#86868b]"
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
            className="group relative flex-shrink-0 w-36 h-28 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 cursor-pointer snap-start transition-all hover:scale-[1.03] hover:shadow-md hover:border-[#0071e3]/50"
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
            <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[9px] font-medium text-white truncate">
              {asset.label?.split("—")[1]?.trim() || asset.label}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Lightbox Modal */}
      <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border border-black/10 dark:border-white/10 bg-black/90 backdrop-blur-2xl text-white shadow-2xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-400" />
              <DialogTitle className="text-sm font-bold text-white">
                {selectedAsset?.label || "Visual Diagram Asset"}
              </DialogTitle>
            </div>
          </div>

          <div className="p-6 flex items-center justify-center max-h-[70vh] overflow-hidden bg-black/50">
            {selectedAsset && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveMediaUrl(selectedAsset.file_url)}
                alt={selectedAsset.label || "Diagram"}
                className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>

          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-white/70">
            <span>Extracted from {fileName}</span>
            <span className="text-[11px] font-mono text-sky-400 font-bold">RAG Visual Anchor</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
