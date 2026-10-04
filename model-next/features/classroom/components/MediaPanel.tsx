"use client";

import React, { useEffect, useState } from "react";
import { X, Image as ImageIcon, Video, Maximize2 } from "lucide-react";
import type { MediaItemDisplay } from "../hooks/useClassroom";

interface MediaPanelProps {
  item: MediaItemDisplay | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function MediaPanel({
  item,
  onDismiss,
  autoDismissMs = 12000,
}: MediaPanelProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const expanded = Boolean(item && expandedUrl === item.url);

  useEffect(() => {
    if (!item || autoDismissMs <= 0) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [item, autoDismissMs, onDismiss]);

  if (!item) return null;

  const isVideo = item.type === "video";

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setExpandedUrl(null)}
        />
      )}

      <div
        className={`fixed z-50 transition-all duration-300 ease-out ${
          expanded
            ? "inset-8 rounded-3xl flex items-center justify-center bg-card/95 backdrop-blur-2xl border border-border/40 shadow-2xl p-6"
            : "bottom-28 left-6 w-[300px] rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/40 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-card/80">
          <div className="flex items-center gap-2 min-w-0">
            {isVideo ? (
              <Video className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <ImageIcon className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              {item.label || (isVideo ? "Lecture Video" : "Curriculum Asset")}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpandedUrl(expanded ? null : item.url)}
              className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground"
              aria-label="Toggle Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`p-3 ${expanded ? "w-full h-full flex items-center justify-center" : ""}`}>
          {isVideo ? (
            <iframe
              src={item.url}
              className="w-full aspect-video rounded-xl bg-black"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={item.label || "Lecture video"}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.label || "Curriculum Visual Asset"}
              className={`rounded-xl object-contain bg-muted/20 ${
                expanded ? "max-h-[75vh] max-w-full" : "w-full max-h-48"
              }`}
            />
          )}
        </div>
      </div>
    </>
  );
}
