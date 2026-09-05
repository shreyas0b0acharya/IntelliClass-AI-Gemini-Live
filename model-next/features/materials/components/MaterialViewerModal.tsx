"use client";

import { useState, useEffect } from "react";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppButton } from "@/components/app";
import {
  FileText,
  ExternalLink,
  Download,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Maximize2,
  Sparkles,
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
    setLoading(true);

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
      <DialogContent className="sm:max-w-5xl h-[90vh] rounded-3xl p-0 overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] shadow-2xl flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 shrink-0 bg-black/[0.015] dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-bold truncate max-w-md">
                  {file.file_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-[11px] text-[#86868b] mt-0.5">
                  <span>{sizeMb} MB</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Indexed for AI Lecture Grounding
                  </span>
                </div>
              </div>
            </div>

            {/* Actions & Tab Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              {matchedDiagrams.length > 0 && (
                <div className="flex items-center bg-black/5 dark:bg-white/10 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab("document")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeTab === "document"
                        ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-xs"
                        : "text-[#86868b] hover:text-foreground"
                    }`}
                  >
                    PDF Document
                  </button>
                  <button
                    onClick={() => setActiveTab("diagrams")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      activeTab === "diagrams"
                        ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-xs"
                        : "text-[#86868b] hover:text-foreground"
                    }`}
                  >
                    <ImageIcon className="h-3 w-3 text-[#0071e3]" />
                    <span>Visuals ({matchedDiagrams.length})</span>
                  </button>
                </div>
              )}

              {viewUrl && (
                <>
                  <AppButton
                    asChild
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    className="h-8 px-2.5 text-xs font-semibold hidden sm:flex"
                    leftIcon={<Download className="h-3.5 w-3.5" />}
                  >
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer" download={file.file_name}>
                      <span>Download</span>
                    </a>
                  </AppButton>

                  <AppButton
                    asChild
                    size="sm"
                    variant="primary"
                    shape="rounded"
                    className="h-8 px-3 text-xs font-bold"
                    leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                  >
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                      <span>Open in Tab</span>
                    </a>
                  </AppButton>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Viewer Content Frame */}
        <div className="flex-1 w-full h-full relative bg-[#f5f5f7] dark:bg-[#121214] overflow-hidden">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-[#0071e3] animate-spin" />
              <p className="text-xs font-semibold text-[#86868b]">Loading document preview...</p>
            </div>
          ) : activeTab === "diagrams" ? (
            <div className="p-6 h-full overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {matchedDiagrams.map((diag) => (
                  <div
                    key={diag.id}
                    onClick={() => setSelectedDiagram(diag)}
                    className="group relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] shadow-xs cursor-pointer hover:border-[#0071e3]/60 transition-all hover:scale-[1.02]"
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
                      <span className="text-[11px] font-bold truncate text-foreground flex-1">
                        {diag.label}
                      </span>
                      {onProjectToStage ? (
                        <AppButton
                          variant="ghost"
                          size="xs"
                          shape="pill"
                          onClick={(e) => {
                            e.stopPropagation();
                            onProjectToStage({
                              type: "image",
                              url: diag.file_url,
                              label: diag.label,
                            });
                            onOpenChange(false);
                          }}
                          className="h-6 px-2 text-[10px] text-[#0071e3] hover:bg-[#0071e3]/10 font-bold shrink-0"
                          title="Project directly to stage"
                        >
                          Project
                        </AppButton>
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5 text-[#86868b] group-hover:text-[#0071e3] shrink-0 ml-1" />
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
              <FileText className="h-10 w-10 text-[#86868b]" />
              <p className="text-sm font-bold text-foreground">Unable to preview document</p>
              <p className="text-xs text-[#86868b] max-w-sm">
                The file URL could not be generated. Please try again or download directly.
              </p>
            </div>
          )}
        </div>

        {/* Selected Diagram Lightbox */}
        {selectedDiagram && (
          <Dialog open={Boolean(selectedDiagram)} onOpenChange={(open) => !open && setSelectedDiagram(null)}>
            <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border border-white/10 bg-black/95 text-white shadow-2xl">
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                <DialogTitle className="text-sm font-bold text-white truncate max-w-md">
                  {selectedDiagram.label}
                </DialogTitle>
                {onProjectToStage && (
                  <AppButton
                    variant="primary"
                    size="sm"
                    shape="pill"
                    onClick={() => {
                      onProjectToStage({
                        type: "image",
                        url: selectedDiagram.file_url,
                        label: selectedDiagram.label || "Projected Diagram",
                      });
                      setSelectedDiagram(null);
                      onOpenChange(false);
                    }}
                    leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                    className="h-8 px-3 text-xs font-semibold shadow-xs"
                  >
                    <span>Project to Stage</span>
                  </AppButton>
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
