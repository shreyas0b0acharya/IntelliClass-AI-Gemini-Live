"use client";

import { useState, useEffect, useCallback } from "react";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Trash2,
  CheckCircle2,
  FileUp,
  Eye,
  Loader2,
  Search,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialImageCarousel } from "./MaterialImageCarousel";
import { MaterialViewerModal } from "./MaterialViewerModal";
import { FileUploadDialog } from "./FileUploadDialog";
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
  onMaterialsUpdated?: () => void;
}

export function MaterialList({
  courseId,
  isLecturer = false,
  refreshTrigger,
  onMaterialsUpdated,
}: MaterialListProps) {
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedViewFile, setSelectedViewFile] = useState<CourseFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getCourseFiles(courseId),
      api.getMediaAssets(courseId).catch(() => ({ assets: [] })),
    ])
      .then(([{ files: fetchedFiles }, { assets: fetchedAssets }]) => {
        if (fetchedFiles) setFiles(fetchedFiles);
        if (fetchedAssets) setMediaAssets(fetchedAssets);
      })
      .catch((err) => {
        console.error("Error fetching course files & media assets:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const filteredFiles = files.filter((f) =>
    f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCourseFile(courseId, deleteTarget.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      toast.success("Document removed from course.");
      if (onMaterialsUpdated) onMaterialsUpdated();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("intelliclass:materials-updated", { detail: { courseId } })
        );
      }
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
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-3xl border border-border/60 bg-card">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card shadow-xs animate-pulse"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="w-10 h-10 shrink-0 rounded-xl" />
              <div className="space-y-2 flex-1 max-w-sm">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Materials Action Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border/60 bg-card shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shrink-0 shadow-xs">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              Course Materials Library ({files.length})
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              Textbooks, lecture slides, and notes indexed for AI vector retrieval.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-1 max-w-md ml-auto justify-end">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials..."
              className="h-9 pl-9 pr-3 text-xs rounded-xl bg-muted/40 border-border/60"
            />
          </div>

          {isLecturer && (
            <FileUploadDialog
              courseId={courseId}
              onUploaded={() => {
                loadData();
                if (onMaterialsUpdated) onMaterialsUpdated();
              }}
              trigger={
                <Button
                  variant="default"
                  className="h-9 px-4 font-semibold rounded-xl gap-2 shadow-xs shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  <span>Add Materials</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* ── Materials Content ──────────────────────────────────────────────── */}
      {files.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-border/70 bg-card/40 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
            <FileUp className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No course documents uploaded yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isLecturer
                ? "Upload PDF textbooks, lecture notes, or research papers. They will be indexed into semantic vector chunks for AI lecture grounding."
                : "Your lecturer has not uploaded reference documents for this course yet."}
            </p>
          </div>

          {isLecturer && (
            <FileUploadDialog
              courseId={courseId}
              onUploaded={() => {
                loadData();
                if (onMaterialsUpdated) onMaterialsUpdated();
              }}
              trigger={
                <Button
                  variant="default"
                  className="h-10 px-5 font-semibold rounded-xl gap-2 shadow-xs mt-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Add Course Materials</span>
                </Button>
              }
            />
          )}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
          No materials matching &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFiles.map((file) => {
            const sizeMb = file.file_size ? (file.file_size / (1024 * 1024)).toFixed(2) : "N/A";
            return (
              <div
                key={file.id}
                className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 transition-all shadow-xs"
              >
                {/* File Info Header */}
                <div className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => setSelectedViewFile(file)}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer group flex-1"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 group-hover:bg-primary/10 flex items-center justify-center text-sky-500 group-hover:text-primary shrink-0 transition-colors shadow-xs">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-md">
                        {file.file_name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{sizeMb} MB</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Indexed for AI Lecture Grounding
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedViewFile(file)}
                      className="h-8 rounded-xl font-semibold gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">Preview PDF</span>
                    </Button>

                    {isLecturer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(file)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl"
                        title="Remove Document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Extracted Diagram Assets Carousel */}
                <MaterialImageCarousel
                  fileName={file.file_name}
                  assets={mediaAssets}
                />
              </div>
            );
          })}
        </div>
      )}

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
        <AlertDialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col justify-between p-8 sm:p-10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <Trash2 className="h-7 w-7" />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                  Remove Document from Materials?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.file_name}&rdquo;</span> will be permanently removed from this Course Space.
                  All semantic embeddings, indexed knowledge chunks, and lecture references derived from this file will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Metadata</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">File Name:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">{deleteTarget?.file_name}</span>
                </div>
                {deleteTarget?.file_size && (
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">File Size:</span>
                    <span className="font-mono text-foreground">{(deleteTarget.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Processing Status:</span>
                  <span className="font-semibold capitalize text-foreground">{deleteTarget?.processing_status || "Processed"}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <span>⚠️ Future lecture topics and AI answers will no longer reference this material.</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-row justify-end gap-3 pt-6 border-t border-border/50 shrink-0">
            <AlertDialogCancel
              disabled={deleting}
              className="rounded-xl px-5 h-11 text-sm font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-xl px-6 h-11 text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-2"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Yes, Remove Document</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
