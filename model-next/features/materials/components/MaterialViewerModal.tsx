"use client";

import { useState, useEffect } from "react";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface MaterialViewerModalProps {
  courseId: string;
  file: CourseFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaAssets?: MediaAsset[];
  onProjectToStage?: (media: { type: "image"; url: string; label: string }) => void;
}

export function MaterialViewerModal({
  courseId,
  file,
  open,
  onOpenChange,
  mediaAssets = [],
  onProjectToStage,
}: MaterialViewerModalProps) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"document" | "diagrams">("document");
  const [selectedDiagram, setSelectedDiagram] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!open || !file) {
      return;
    }

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) setLoading(true);
    });

    api
      .getCourseFileViewUrl(courseId, file.id)
      .then((res) => {
        if (isMounted && res?.viewUrl) {
          setViewUrl(res.viewUrl);
        }
      })
      .catch((err) => {
        console.error("Failed to load PDF view URL:", err);
        toast.error("Could not load PDF document.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [courseId, file, open]);

  if (!file) return null;

  const sizeMb = file.file_size ? (file.file_size / (1024 * 1024)).toFixed(2) : "N/A";
  const baseName = file.file_name.replace(/\.[^/.]+$/, "").toLowerCase();
  const matchedDiagrams = mediaAssets.filter((a) => {
    const labelLower = a.label?.toLowerCase() || "";
    return labelLower.includes(baseName) || a.label.toLowerCase().includes(file.file_name.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] sm:w-[92vw] md:w-[88vw] lg:w-[80vw] max-w-[96vw] sm:max-w-[92vw] md:max-w-[88vw] lg:max-w-[80vw] h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl sm:rounded-3xl border border-border/60 bg-popover shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 p-4 sm:p-5 px-6 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold truncate">
                  {file.file_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{sizeMb} MB</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-chart-2 dark:text-chart-2 font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Indexed for AI Lecture Grounding
                  </span>
                </div>
              </div>
            </div>

            {/* Actions & Tab Switcher */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {matchedDiagrams.length > 0 && (
                <div className="flex items-center bg-black/5 dark:bg-white/10 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("document")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === "document"
                        ? "bg-white dark:bg-muted text-foreground dark:text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    PDF Document
                  </button>
                  <button
                    onClick={() => setActiveTab("diagrams")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      activeTab === "diagrams"
                        ? "bg-white dark:bg-muted text-foreground dark:text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ImageIcon className="h-3 w-3 text-primary" />
                    <span>Visuals ({matchedDiagrams.length})</span>
                  </button>
                </div>
              )}

              {viewUrl && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 hidden sm:flex rounded-xl"
                  >
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" download={file.file_name} className="inline-flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </a>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    variant="default"
                    className="h-8 rounded-xl shadow-xs"
                  >
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Tab</span>
                    </a>
                  </Button>
                </>
              )}

              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {/* Viewer Content Frame */}
        <div className="flex-1 w-full h-full relative bg-muted dark:bg-background overflow-hidden">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-muted-foreground">Loading document preview...</p>
            </div>
          ) : activeTab === "diagrams" ? (
            <div className="p-6 h-full overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {matchedDiagrams.map((diag) => (
                  <div
                    key={diag.id}
                    onClick={() => setSelectedDiagram(diag)}
                    className="group relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-card shadow-xs cursor-pointer hover:border-primary/60 transition-all hover:scale-[1.02]"
                  >
                    <div className="w-full h-40 overflow-hidden bg-black/5 dark:bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={diag.file_url}
                        alt={diag.label}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2.5 bg-black/[0.02] dark:bg-white/[0.03] border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate text-foreground flex-1">
                        {diag.label}
                      </span>
                      {onProjectToStage ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onProjectToStage({
                              type: "image",
                              url: diag.file_url,
                              label: diag.label,
                            });
                            onOpenChange(false);
                          }}
 className="h-6 shrink-0 "
                          title="Project directly to stage"
                        >
                          Project
                        </Button>
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : viewUrl ? (
            <iframe
              src={`${viewUrl}#toolbar=1&navpanes=0`}
              title={file.file_name}
              className="w-full h-full border-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-6">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">Unable to preview document</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                The file URL could not be generated. Please try again or download directly.
              </p>
            </div>
          )}
        </div>

        {/* Selected Diagram Lightbox */}
        {selectedDiagram && (
          <Dialog open={Boolean(selectedDiagram)} onOpenChange={(open) => !open && setSelectedDiagram(null)}>
 <DialogContent className="max-w-3xl overflow-hidden ">
 <div className="p-4 border-b flex items-center justify-between gap-3">
 <DialogTitle className=" max-w-md">
                  {selectedDiagram.label}
                </DialogTitle>
                {onProjectToStage && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      onProjectToStage({
                        type: "image",
                        url: selectedDiagram.file_url,
                        label: selectedDiagram.label || "Projected Diagram",
                      });
                      setSelectedDiagram(null);
                      onOpenChange(false);
                    }}
 className="h-8 inline-flex items-center "
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Project to Stage</span>
                  </Button>
                )}
              </div>
              <div className="p-6 flex items-center justify-center max-h-[70vh] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedDiagram.file_url}
                  alt={selectedDiagram.label}
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
