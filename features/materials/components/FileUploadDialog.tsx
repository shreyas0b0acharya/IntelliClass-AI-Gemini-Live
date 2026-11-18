"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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

      if (!uploadRes.isProcessingInBackground && !uploadRes.totalChunks) {
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
      } else {
        toast.success("Document uploaded! Vector embeddings are processing in background.");
      }

      setFile(null);
      setOpen(false);
      // Dispatch global event so parent tabs, roadmap builder, and header badges sync immediately
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("intelliclass:materials-updated", { detail: { courseId } })
        );
      }
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
          <Button
            variant="outline"
 className=" inline-flex items-center "
          >
            <Upload className="h-4 w-4 text-primary" />
            <span>Upload Syllabus PDF</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary mb-1">
            <FileUp className="h-5 w-5" />
          </div>
          <DialogTitle>Upload Syllabus Document</DialogTitle>
          <DialogDescription>
            Upload course textbook or syllabus PDF. Content is automatically chunked and indexed for interactive AI teaching.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 pt-6 items-stretch">
          {/* Left: Drag & Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-primary/60 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-center h-full"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={isUploading}
            />
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Upload className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {file ? file.name : "Click to browse or drop PDF file here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF format up to 50MB supported"}
            </p>

            {statusText && (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary animate-pulse mt-4 px-3 py-1.5 rounded-full bg-primary/10">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{statusText}</span>
              </div>
            )}
          </div>

          {/* Right: Processing & Document Pipeline Info */}
          <div className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Automated Processing Pipeline</h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">Visual Diagram &amp; Figure Extraction</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">PyMuPDF extracts diagrams and architectural figures for live projection onto the classroom whiteboard.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">Semantic Chunking &amp; Vector Embeddings</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Content is embedded into 768-dimensional vectors in PostgreSQL pgvector for sub-second RAG retrieval.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">Gemini Live Grounding</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">The AI Professor will cite textbook excerpts in real time during live lecture delivery and voice Q&amp;A.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground">
              💡 Tip: Upload chapter-by-chapter for faster indexing and targeted lecture modules.
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t border-black/5 dark:border-white/5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
            className="h-10"
          >
            <span>Cancel</span>
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !file}
            variant="default"
            className="h-10 inline-flex items-center"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mr-1.5" />
                <span>Uploading &amp; Indexing...</span>
              </>
            ) : (
              <span>Upload &amp; Index</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
