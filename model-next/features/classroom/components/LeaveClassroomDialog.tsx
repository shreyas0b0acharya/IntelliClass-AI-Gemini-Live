"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Radio, X } from "lucide-react";

interface LeaveClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLecturer: boolean;
  sessionStatus: string;
  /** Called when user picks "Stop & Leave" */
  onStopAndLeave: () => void;
  /** Called when user picks "Continue in Background" */
  onContinueInBackground: () => void;
}

export function LeaveClassroomDialog({
  open,
  onOpenChange,
  isLecturer,
  sessionStatus,
  onStopAndLeave,
  onContinueInBackground,
}: LeaveClassroomDialogProps) {
  const isLive = sessionStatus === "running";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-5 border-b border-border/40">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-3">
              <LogOut className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Leave Classroom?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {isLecturer && isLive
                ? "The session is currently live. Choose how you want to proceed."
                : "Are you sure you want to leave this classroom?"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-3">
          {/* Stop & Leave — destructive action */}
          <Button
            onClick={onStopAndLeave}
            variant="destructive"
            size="lg"
            className="w-full font-semibold rounded-xl inline-flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>{isLecturer && isLive ? "End Session & Leave" : "Leave Classroom"}</span>
          </Button>

          {/* Continue in Background — only if there's something running */}
          {isLive && (
            <Button
              onClick={onContinueInBackground}
              variant="outline"
              size="lg"
              className="w-full font-semibold border-2 justify-start px-4 rounded-xl inline-flex items-center gap-2"
            >
              <Radio className="h-4 w-4 text-red-500 shrink-0" />
              <span>Continue in Background</span>
              <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                LIVE
              </span>
            </Button>
          )}

          {/* Cancel */}
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            size="default"
            className="w-full font-medium text-muted-foreground hover:text-foreground rounded-xl inline-flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            <span>Stay in Classroom</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
