"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppButton } from "@/components/app/AppButton";
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
          <AppButton
            onClick={onStopAndLeave}
            variant="destructive"
            size="lg"
            shape="rounded"
            className="w-full font-semibold"
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            <span>{isLecturer && isLive ? "End Session & Leave" : "Leave Classroom"}</span>
          </AppButton>

          {/* Continue in Background — only if there's something running */}
          {isLive && (
            <AppButton
              onClick={onContinueInBackground}
              variant="outline"
              size="lg"
              shape="rounded"
              className="w-full font-semibold border-2 justify-start px-4"
              leftIcon={<Radio className="h-4 w-4 text-red-500" />}
            >
              <span>Continue in Background</span>
              <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                LIVE
              </span>
            </AppButton>
          )}

          {/* Cancel */}
          <AppButton
            onClick={() => onOpenChange(false)}
            variant="ghost"
            size="default"
            shape="rounded"
            className="w-full font-medium text-muted-foreground hover:text-foreground"
            leftIcon={<X className="h-4 w-4" />}
          >
            <span>Stay in Classroom</span>
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
