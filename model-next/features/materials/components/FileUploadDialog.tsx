"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { AppButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileUploadDialogProps {
  courseId: string;
  onUploaded?: () => void;
  trigger?: React.ReactNode;
}

export function FileUploadDialog({ courseId, onUploaded, trigger }: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please choose a PDF document to upload.");
      return;
    }

    setIsUploading(true);
    setStatusText("Uploading document to course...");

    try {
      const uploadRes = await api.uploadCourseFile(courseId, file);
      const uploadedFile = uploadRes.file;

      setStatusText("Indexing syllabus content & generating RAG chunks...");
      try {
        await api.processCourseFile({
          fileUrl: uploadRes.fileUrl,
          fileName: uploadedFile.file_name,
          courseId,
        });
        toast.success("Document uploaded and indexed successfully!");
      } catch (procErr) {
        console.warn("Backend vector processing warning:", procErr);
        toast.info("Document saved. Vector embeddings processing in background.");
      }

      setFile(null);
      setOpen(false);
      if (onUploaded) onUploaded();
    } catch (err: unknown) {
      console.error("Upload/Processing error:", err);
      const msg = err instanceof Error ? err.message : "Failed to complete upload.";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setStatusText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <AppButton
            variant="outline"
            shape="pill"
            className="px-5 py-2.5 bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/10 dark:border-white/10 font-medium text-xs sm:text-sm shadow-xs"
            leftIcon={<Upload className="h-4 w-4 text-[#0071e3]" />}
          >
            <span>Upload Syllabus PDF</span>
          </AppButton>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 border border-black/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3] mb-1">
            <FileUp className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Upload Syllabus Document</DialogTitle>
          <DialogDescription className="text-xs text-[#86868b]">
            Upload course textbook or syllabus PDF. Content is automatically chunked and indexed for interactive AI teaching.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-[#0071e3]/60 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-center"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={isUploading}
            />
            <Upload className="h-8 w-8 text-[#0071e3] mb-2" />
            <p className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {file ? file.name : "Click to browse or drop PDF file here"}
            </p>
            <p className="text-[11px] text-[#86868b] mt-1">
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF format up to 25MB"}
            </p>
          </div>

          {statusText && (
            <div className="flex items-center gap-2 text-xs font-medium text-[#0071e3] animate-pulse px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{statusText}</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <AppButton
            type="button"
            variant="outline"
            shape="pill"
            onClick={() => setOpen(false)}
            disabled={isUploading}
            className="px-5 h-10 border-black/10 dark:border-white/10 font-medium text-xs bg-white dark:bg-[#2c2c2e]"
          >
            <span>Cancel</span>
          </AppButton>
          <AppButton
            onClick={handleUpload}
            disabled={isUploading || !file}
            isLoading={isUploading}
            loadingText="Uploading..."
            variant="primary"
            shape="pill"
            className="px-5 h-10 text-xs font-medium"
          >
            <span>Upload &amp; Index</span>
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
