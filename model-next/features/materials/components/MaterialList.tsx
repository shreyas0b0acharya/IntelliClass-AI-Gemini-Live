"use client";

import { useState, useEffect } from "react";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Trash2, CheckCircle2, FileUp, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            className="flex items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
 <Skeleton className="w-10 h-10 shrink-0" />
              <div className="space-y-2 flex-1 max-w-sm">
 <Skeleton className="h-4 w-44 " />
 <Skeleton className="h-3 w-28 " />
              </div>
            </div>
 {isLecturer && <Skeleton className="h-8 w-8 shrink-0" />}
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-10 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center mx-auto text-muted-foreground">
          <FileUp className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground dark:text-foreground">No course documents uploaded yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
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
              className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card hover:border-black/15 dark:hover:border-white/15 transition-all shadow-xs"
            >
              {/* File Info Header */}
              <div className="flex items-center justify-between">
                <div
                  onClick={() => setSelectedViewFile(file)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
                >
                  <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 group-hover:bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-foreground dark:text-foreground group-hover:text-primary transition-colors truncate max-w-sm">
                      {file.file_name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{sizeMb} MB</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 text-chart-2 dark:text-chart-2 font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Indexed for RAG
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedViewFile(file)}
 className="h-8 inline-flex items-center "
                  >
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">View PDF</span>
                  </Button>

                  {isLecturer && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(file)}
 className="h-8 w-8 "
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
 <AlertDialogContent className=" overflow-hidden max-w-sm ">
 <div className="p-6 border-b border-black/5 ">
            <AlertDialogHeader>
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
 <AlertDialogTitle className="">
                Remove Document?
              </AlertDialogTitle>
 <AlertDialogDescription className=" mt-1 ">
 <span className="font-semibold ">
                  &ldquo;{deleteTarget?.file_name}&rdquo;
                </span>{" "}
                will be permanently removed and its indexed chunks will be deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
 <AlertDialogFooter className=" flex-col sm:flex-col">
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
 className="w-full h-10 "
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Yes, Remove Document</>
              )}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={deleting}
 className="w-full h-10 mt-0 "
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
