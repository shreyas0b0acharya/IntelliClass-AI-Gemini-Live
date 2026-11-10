"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ClassroomSession } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DEFAULT_MALE_VOICE_ID, DEFAULT_FEMALE_VOICE_ID } from "@/config";
import { Pencil, Save, Loader2, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface EditSessionDialogProps {
  session: ClassroomSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: ClassroomSession) => void;
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
}: EditSessionDialogProps) {
  const [topic, setTopic] = useState(session.topic);
  const [voiceGender, setVoiceGender] = useState(
    VOICE_MAP[session.voice_id || DEFAULT_MALE_VOICE_ID] ?? "male"
  );
  const [script, setScript] = useState(session.script || "");
  const [showScriptSection, setShowScriptSection] = useState(Boolean(session.script));
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
        script: script.trim(),
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

  const wordCount = script.split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:w-[90vw] md:w-[84vw] lg:w-[80vw] max-w-[95vw] sm:max-w-[92vw] md:max-w-[86vw] lg:max-w-[80vw] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-b from-muted/60 to-background p-6 border-b">
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
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Lecture Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Introduction to Neural Networks"
              className="h-11"
              disabled={saving}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>AI Lecturer Gender</Label>
            <RadioGroup
              value={voiceGender}
              onValueChange={setVoiceGender}
              className="grid grid-cols-2"
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
                  <div className="text-xs text-muted-foreground">Prof. Sharma</div>
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
                  <div className="text-xs text-muted-foreground">Prof. Bella</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Lecture Script Section */}
          <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowScriptSection((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4 text-primary" />
                <span>Lecture Script</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({wordCount > 0 ? `${wordCount} words` : "No script"})
                </span>
                {showScriptSection ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {script && (
                <button
                  type="button"
                  onClick={() => setScript("")}
                  className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1 cursor-pointer"
                  title="Clear script text"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {showScriptSection && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste or edit the lecture script text here... Use [PAUSE] for pauses."
                  rows={6}
                  className="text-xs font-sans leading-relaxed resize-y"
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Tip: Insert <code className="text-primary font-bold bg-primary/10 px-1 rounded">[PAUSE]</code> to let students absorb complex topics.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
 className="flex-1 "
            >
              <span>Cancel</span>
            </Button>
            <Button
              type="submit"
              disabled={saving || !topic.trim()}
              variant="default"
 className="flex-1 inline-flex items-center justify-center "
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
