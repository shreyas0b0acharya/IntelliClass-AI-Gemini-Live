"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ClassroomSession } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_MALE_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
} from "@/config";
import { getVoiceGender } from "@/features/avatar";
import { Pencil, Save, Loader2, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface EditSessionDialogProps {
  session: ClassroomSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: ClassroomSession) => void;
  onOpenScript?: (session: ClassroomSession) => void;
}

const VOICE_MAP: Record<string, string> = {
  [DEFAULT_FEMALE_VOICE_ID]: "female",
  [DEFAULT_MALE_VOICE_ID]: "male",
};

const GENDER_TO_VOICE: Record<string, string> = {
  female: DEFAULT_FEMALE_VOICE_ID,
  male: DEFAULT_MALE_VOICE_ID,
};

export function EditSessionDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
  onOpenScript,
}: EditSessionDialogProps) {
  const [topic, setTopic] = useState(session.topic);
  const [voiceGender, setVoiceGender] = useState(
    () => getVoiceGender(session.voice_id || DEFAULT_MALE_VOICE_ID)
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic cannot be empty.");
      return;
    }

    const newVoiceId = GENDER_TO_VOICE[voiceGender];
    const newAvatarModel =
      voiceGender === "female" ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_MALE_AVATAR_MODEL;
    setSaving(true);
    try {
      const { session: updated } = await api.updateSessionMeta(session.id, {
        topic: topic.trim(),
        voice_id: newVoiceId,
        avatar_model: newAvatarModel,
      });
      toast.success("Session updated successfully.");
      onUpdated(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update session.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-b from-muted/60 to-background p-6 border-b border-black/5 dark:border-white/10 shrink-0">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Pencil className="h-5 w-5" />
            </div>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription className="mt-0.5">
              Update the lecture topic, AI lecturer voice, and curriculum script.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col justify-between p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 items-start">
            {/* Left Column: Topic & Script */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Lecture Topic</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Introduction to Neural Networks"
                  className="h-11"
                  disabled={saving}
                  required
                />
              </div>

              {/* Lecture Script Link to Unified Modal */}
              <div className="space-y-2">
                <Label className="text-sm font-bold">Lecture Curriculum Script</Label>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground">Curriculum Script</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {session.script
                          ? `${session.script.split(/\s+/).filter(Boolean).length} words ready for broadcast`
                          : "No script generated yet"}
                      </div>
                    </div>
                  </div>

                  {onOpenScript && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenScript(session);
                      }}
                      className="h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl border-border/70 hover:bg-muted transition-all shrink-0 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span>Inspect Script</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Persona & Gender */}
            <div className="space-y-4">
              <Label className="text-sm font-bold">AI Lecturer Persona &amp; Voice</Label>
              <RadioGroup
                value={voiceGender}
                onValueChange={(val) => setVoiceGender(val as "male" | "female")}
                className="grid grid-cols-2 gap-4"
                disabled={saving}
              >
                <label
                  htmlFor="edit-male"
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${voiceGender === "male"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border bg-card/40"
                    }`}
                >
                  <RadioGroupItem value="male" id="edit-male" />
                  <div>
                    <div className="text-sm font-bold">Male</div>
                    <div className="text-xs text-muted-foreground">Prof. Arthur (Charon)</div>
                  </div>
                </label>
                <label
                  htmlFor="edit-female"
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${voiceGender === "female"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border bg-card/40"
                    }`}
                >
                  <RadioGroupItem value="female" id="edit-female" />
                  <div>
                    <div className="text-sm font-bold">Female</div>
                    <div className="text-xs text-muted-foreground">Dr. Clara (Aoede)</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t border-black/5 dark:border-white/5 flex gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-10 px-6"
            >
              <span>Cancel</span>
            </Button>
            <Button
              type="submit"
              disabled={saving || !topic.trim()}
              variant="default"
              className="h-10 px-6 inline-flex items-center justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
