"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Settings2,
  Volume2,
  Square,
  Loader2,
  Check,
  User,
  AlertTriangle,
  Lock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { unlockAudioContext } from "@/features/avatar";
import type { SessionStateStatus } from "../types/classroom";
import { VOICE_OPTIONS } from "@/features/settings/services/settings";

interface ClassroomConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionStatus: SessionStateStatus;
  currentVoiceId?: string;
  currentAvatarModel?: string;
  onSave: (config: {
    voiceId: string;
    avatarModel: string;
    personaName: string;
  }) => Promise<void>;
}

export function ClassroomConfigModal({
  open,
  onOpenChange,
  sessionStatus,
  currentVoiceId,
  currentAvatarModel,
  onSave,
}: ClassroomConfigModalProps) {
  const isLocked = sessionStatus === "running" || sessionStatus === "paused";

  const isFemale = (currentVoiceId || "am_fenrir").startsWith("af_");
  const [gender, setGender] = useState<"male" | "female">(isFemale ? "female" : "male");
  const [voiceId, setVoiceId] = useState<string>(currentVoiceId || "am_fenrir");
  const [avatarModel, setAvatarModel] = useState<string>(
    currentAvatarModel || (isFemale ? "women-avatarsdk" : "men-avatarsdk")
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenderChange = (newGender: "male" | "female") => {
    if (isLocked) return;
    setGender(newGender);
    if (newGender === "male") {
      setVoiceId("am_fenrir");
      setAvatarModel("men-avatarsdk");
    } else {
      setVoiceId("af_bella");
      setAvatarModel("women-avatarsdk");
    }
    stopPreviewAudio();
  };

  const stopPreviewAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const handleTestVoice = async () => {
    unlockAudioContext();

    if (isPlayingPreview) {
      stopPreviewAudio();
      return;
    }

    setIsSynthesizing(true);
    try {
      const sampleText =
        gender === "male"
          ? "Hello class, I am Professor Arthur. I am ready to conduct today's lecture."
          : "Hello class, I am Doctor Clara. I am ready to conduct today's lecture.";

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleText,
          voice: voiceId,
          speed: 1.0,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "HeadTTS service error" }));
        throw new Error(err.error || "Failed to synthesize voice preview.");
      }

      const data = await res.json();
      if (!data.audio) {
        throw new Error("No audio returned from speech synthesis.");
      }

      const audio = new Audio(data.audio);
      audio.onended = () => {
        setIsPlayingPreview(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingPreview(false);
        audioRef.current = null;
        toast.error("Audio playback error.");
      };

      audioRef.current = audio;
      setIsPlayingPreview(true);
      await audio.play();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to preview voice.";
      toast.error(msg);
      setIsPlayingPreview(false);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleApply = async () => {
    if (isLocked) {
      toast.error(
        "Settings cannot be modified while the lecture is live or paused."
      );
      return;
    }

    stopPreviewAudio();
    setIsSaving(true);
    try {
      const personaName = gender === "male" ? "Prof. Arthur" : "Dr. Clara";
      await onSave({
        voiceId,
        avatarModel,
        personaName,
      });
      onOpenChange(false);
    } catch {
      // Error handled in onSave
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 p-6 border-b">
          <DialogHeader>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Settings2 className="h-5 w-5" />
            </div>
            <DialogTitle>Classroom AI Persona &amp; Voice</DialogTitle>
            <DialogDescription className="mt-0.5">
              Customize the 3D avatar model and neural voice for this session.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* State Banner */}
        <div className="px-6 pt-4">
          {isLocked ? (
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Settings Locked During Active Lecture</p>
                <p className="text-muted-foreground mt-0.5">
                  Voice and avatar models cannot be altered while the broadcast
                  is live or paused. End or conclude the broadcast to update
                  settings.
                </p>
              </div>
            </div>
          ) : sessionStatus === "created" ? (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                <strong>Standby Mode:</strong> Settings will take effect
                immediately before starting the broadcast.
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted border text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-chart-4" />
              <span>
                <strong>Lecture Ended:</strong> Settings will be used when
                restarting the session.
              </span>
            </div>
          )}
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-5">
          {/* Persona Tiles */}
          <div className="space-y-2">
            <Label>Lecturer Persona</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Male Persona */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handleGenderChange("male")}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
                  gender === "male"
                    ? "border-primary bg-primary/10 ring-1 ring-ring/40 shadow-xs"
                    : "border-border bg-card hover:bg-muted"
                } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
                    gender === "male"
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-foreground truncate block">
                    Prof. Arthur
                  </span>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Male • Fenrir
                  </p>
                </div>
                {gender === "male" && (
                  <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-2" />
                  </div>
                )}
              </button>

              {/* Female Persona */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handleGenderChange("female")}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
                  gender === "female"
                    ? "border-primary bg-primary/10 ring-1 ring-ring/40 shadow-xs"
                    : "border-border bg-card hover:bg-muted"
                } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
                    gender === "female"
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-foreground truncate block">
                    Dr. Clara
                  </span>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Female • Bella
                  </p>
                </div>
                {gender === "female" && (
                  <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 stroke-2" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Voice Model Selection */}
          <div className="space-y-2">
            <Label>Neural Kokoro Voice</Label>
            <div className="space-y-2">
              {VOICE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    setVoiceId(opt.id);
                    setGender(opt.gender as "male" | "female");
                    setAvatarModel(
                      opt.gender === "female"
                        ? "women-avatarsdk"
                        : "men-avatarsdk"
                    );
                    stopPreviewAudio();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    voiceId === opt.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Volume2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground block truncate">
                        {opt.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {opt.id}
                      </span>
                    </div>
                  </div>
                  {voiceId === opt.id && (
                    <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-2" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Preview Button */}
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSynthesizing}
              onClick={handleTestVoice}
              className="w-full inline-flex items-center justify-center"
            >
              {isSynthesizing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing Voice...</span>
                </span>
              ) : isPlayingPreview ? (
                <span className="flex items-center gap-2">
                  <Square className="h-3.5 w-3.5 fill-current text-destructive" />
                  <span>Stop Preview Audio</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                  <span>Test Audio Synthesis</span>
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2">
          <DialogFooter>
           <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={isLocked || isSaving}
            onClick={handleApply}
            className="inline-flex items-center"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Applying...</span>
              </span>
            ) : (
              <span>Save &amp; Apply</span>
            )}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
