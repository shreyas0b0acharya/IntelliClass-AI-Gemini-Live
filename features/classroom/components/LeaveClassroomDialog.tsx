"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Radio, X, CheckCircle2, FileText } from "lucide-react";
import { useState } from "react";

interface LeaveClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLecturer: boolean;
  sessionStatus: string;
  /** Called when user picks "Stop & Leave" */
  onStopAndLeave: () => void;
  /** Called when user picks "Continue in Background" */
  onContinueInBackground: () => void;
  onSaveNotesAsMaterial?: (title?: string) => Promise<unknown>;
}

export function LeaveClassroomDialog({
  open,
  onOpenChange,
  isLecturer,
  sessionStatus,
  onStopAndLeave,
  onContinueInBackground,
  onSaveNotesAsMaterial,
}: LeaveClassroomDialogProps) {
  const isLive = sessionStatus === "running";
  const [savedNotes, setSavedNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const handleSaveNotes = async () => {
    if (!onSaveNotesAsMaterial) return;
    setSavingNotes(true);
    try {
      await onSaveNotesAsMaterial();
      setSavedNotes(true);
    } catch {
      // toast handled in caller
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col justify-between">
        {/* Header */}
        <div className="p-6 pb-5 border-b border-border/40 shrink-0">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-3">
              <LogOut className="h-6 w-6" />
            </div>
            <DialogTitle>Leave Classroom?</DialogTitle>
            <DialogDescription className="mt-1">
              {isLecturer && isLive
                ? "The session is currently live. Choose how you want to proceed."
                : "Are you sure you want to leave this classroom?"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Body: 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 flex-1 min-h-0 items-center">
          {/* Left Column: Lecture Notes Auto-Save & Checkpoints */}
          <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-bold text-sm text-foreground">Lecture Notes Checkpoint</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Auto-Saved</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All speech transcripts, student Q&amp;A summaries, and whiteboard figures have been durably captured and saved to the database.
            </p>
            {isLecturer && onSaveNotesAsMaterial && (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleSaveNotes}
                disabled={savingNotes || savedNotes}
                className="w-full h-11 text-xs font-semibold"
              >
                <FileText className="h-4 w-4 mr-2 text-primary" />
                <span>{savedNotes ? "✓ Promoted to Course Material" : savingNotes ? "Saving to Course Space..." : "Promote Notes to Course Material"}</span>
              </Button>
            )}
          </div>

          {/* Right Column: Exit Options */}
          <div className="space-y-4">
            {/* Stop & Leave — destructive action */}
            <Button
              onClick={onStopAndLeave}
              variant="destructive"
              size="lg"
              className="w-full h-12 inline-flex items-center justify-center text-sm font-semibold"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>{isLecturer && isLive ? "End Session & Leave" : "Leave Classroom"}</span>
            </Button>

            {/* Continue in Background — only if there's something running */}
            {isLive && (
              <Button
                onClick={onContinueInBackground}
                variant="outline"
                size="lg"
                className="w-full h-12 justify-between inline-flex items-center text-sm font-semibold"
              >
                <span className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-destructive shrink-0" />
                  <span>Continue in Background</span>
                </span>
                <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              </Button>
            )}

            {/* Cancel */}
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              size="lg"
              className="w-full h-11 inline-flex items-center justify-center text-sm font-medium"
            >
              <X className="h-4 w-4 mr-2" />
              <span>Stay in Classroom</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
