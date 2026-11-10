"use client";

import type { ClassroomSession } from "@/lib/supabase/types";
import { LectureScriptModal } from "@/features/classroom";
import { api } from "@/lib/api";

export interface ManageScriptDialogProps {
  session: ClassroomSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: ClassroomSession) => void;
  isLecturer?: boolean;
}

export function ManageScriptDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
  isLecturer = true,
}: ManageScriptDialogProps) {
  if (!session) return null;

  return (
    <LectureScriptModal
      open={open}
      onOpenChange={onOpenChange}
      topic={session.topic}
      isLecturer={isLecturer}
      status={session.status}
      rawScript={session.script || ""}
      sessionId={session.id}
      meetingCode={session.meeting_code}
      onSaveScript={async (newScript) => {
        const { session: updated } = await api.updateClassroomSession(session.id, {
          script: newScript,
        });
        if (onUpdated && updated) onUpdated(updated);
      }}
      onDeleteScript={async () => {
        const { session: updated } = await api.updateClassroomSession(session.id, {
          script: "",
        });
        if (onUpdated && updated) onUpdated(updated);
      }}
    />
  );
}
