"use client";

import { useState, useEffect } from "react";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Trash2, CheckCircle2, FileUp, Eye, Loader2 } from "lucide-react";
import { AppButton } from "@/components/app";
import { MaterialImageCarousel } from "./MaterialImageCarousel";
import { MaterialViewerModal } from "./MaterialViewerModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface MaterialListProps {
  courseId: string;
  isLecturer?: boolean;
  refreshTrigger?: number;
}

export function MaterialList({ courseId, isLecturer = false, refreshTrigger }: MaterialListProps) {
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViewFile, setSelectedViewFile] = useState<CourseFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getCourseFiles(courseId),
      api.getMediaAssets(courseId).catch(() => ({ assets: [] })),
    ])
      .then(([{ files: fetchedFiles }, { assets: fetchedAssets }]) => {
        if (active) {
          if (fetchedFiles) setFiles(fetchedFiles);
          if (fetchedAssets) setMediaAssets(fetchedAssets);
        }
      })
      .catch((err) => {
        console.error("Error fetching course files & media assets:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [courseId, refreshTrigger]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCourseFile(courseId, deleteTarget.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      toast.success("Document removed from course.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete file.";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1 max-w-sm">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
            </div>
            {isLecturer && <Skeleton className="h-8 w-8 rounded-lg shrink-0" />}
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-10 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-[#86868b]">
          <FileUp className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">No course documents uploaded yet</p>
        <p className="text-xs text-[#86868b] max-w-xs mx-auto leading-relaxed">
          {isLecturer
            ? "Upload PDF textbooks, lecture notes, or research papers to teach with AI."
            : "Your professor will upload curriculum materials for this course."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {files.map((file) => {
          const sizeMb = file.file_size ? (file.file_size / (1024 * 1024)).toFixed(2) : "N/A";
          return (
            <div
              key={file.id}
              className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] hover:border-black/15 dark:hover:border-white/15 transition-all shadow-xs"
            >
              {/* File Info Header */}
              <div className="flex items-center justify-between">
                <div
                  onClick={() => setSelectedViewFile(file)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
                >
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 group-hover:bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] shrink-0 transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] group-hover:text-[#0071e3] transition-colors truncate max-w-sm">
                      {file.file_name}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-[#86868b]">
                      <span>{sizeMb} MB</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Indexed for RAG
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <AppButton
                    variant="outline"
                    size="sm"
                    shape="rounded"
                    onClick={() => setSelectedViewFile(file)}
                    className="h-8 px-2.5 text-xs font-semibold border-black/10 dark:border-white/10 hover:border-[#0071e3]/50"
                    leftIcon={<Eye className="h-3.5 w-3.5 text-[#0071e3]" />}
                  >
                    <span className="hidden sm:inline">View PDF</span>
                  </AppButton>

                  {isLecturer && (
                    <AppButton
                      variant="ghost"
                      size="icon-sm"
                      shape="rounded"
                      onClick={() => setDeleteTarget(file)}
                      className="h-8 w-8 text-[#86868b] hover:text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </AppButton>
                  )}
                </div>
              </div>

              {/* Visual Diagrams Carousel Under Each Material */}
              <MaterialImageCarousel fileName={file.file_name} assets={mediaAssets} />
            </div>
          );
        })}
      </div>

      {/* Universal PDF Document Viewer */}
      <MaterialViewerModal
        courseId={courseId}
        file={selectedViewFile}
        open={Boolean(selectedViewFile)}
        onOpenChange={(open) => !open && setSelectedViewFile(null)}
        mediaAssets={mediaAssets}
      />

      {/* Polished Delete Confirm Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl p-0 overflow-hidden max-w-sm bg-[#f5f5f7] dark:bg-[#1c1c1e]">
          <div className="p-6 border-b border-black/5 dark:border-white/10">
            <AlertDialogHeader>
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Remove Document?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-[#86868b] mt-1 leading-relaxed">
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  &ldquo;{deleteTarget?.file_name}&rdquo;
                </span>{" "}
                will be permanently removed and its indexed chunks will be deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-6 pt-4 flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="w-full h-10 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-xs gap-2"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Yes, Remove Document</>
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={deleting}
              className="w-full h-10 rounded-full mt-0 border border-black/10 dark:border-white/10 font-medium text-xs bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
