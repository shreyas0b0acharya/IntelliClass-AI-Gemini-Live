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
import { Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditSessionDialogProps {
  session: ClassroomSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: ClassroomSession) => void;
}

const VOICE_MAP: Record<string, string> = {
  af_bella: "female",
  am_fenrir: "male",
};

const GENDER_TO_VOICE: Record<string, string> = {
  female: "af_bella",
  male: "am_fenrir",
};

export function EditSessionDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
}: EditSessionDialogProps) {
  const [topic, setTopic] = useState(session.topic);
  const [voiceGender, setVoiceGender] = useState(
    VOICE_MAP[session.voice_id || "am_fenrir"] ?? "male"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic cannot be empty.");
      return;
    }

    const newVoiceId = GENDER_TO_VOICE[voiceGender];
    setSaving(true);
    try {
      const { session: updated } = await api.updateSessionMeta(session.id, {
        topic: topic.trim(),
        voice_id: newVoiceId,
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
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-b from-muted/60 to-background p-6 border-b">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Pencil className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">Edit Session</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Update the lecture topic and AI lecturer voice.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lecture Topic
            </Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Introduction to Neural Networks"
              className="h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/30"
              disabled={saving}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AI Lecturer Gender
            </Label>
            <RadioGroup
              value={voiceGender}
              onValueChange={setVoiceGender}
              className="grid grid-cols-2 gap-3"
              disabled={saving}
            >
              <label
                htmlFor="edit-male"
                className={`flex items-center gap-2.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${voiceGender === "male"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border bg-card/40"
                  }`}
              >
                <RadioGroupItem value="male" id="edit-male" />
                <div>
                  <div className="text-xs font-bold">Male</div>
                  <div className="text-[10px] text-muted-foreground">Prof. Sharma</div>
                </div>
              </label>
              <label
                htmlFor="edit-female"
                className={`flex items-center gap-2.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${voiceGender === "female"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-border bg-card/40"
                  }`}
              >
                <RadioGroupItem value="female" id="edit-female" />
                <div>
                  <div className="text-xs font-bold">Female</div>
                  <div className="text-[10px] text-muted-foreground">Prof. Bella</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 rounded-xl"
            >
              <span>Cancel</span>
            </Button>
            <Button
              type="submit"
              disabled={saving || !topic.trim()}
              variant="default"
              className="flex-1 font-semibold rounded-xl inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
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
