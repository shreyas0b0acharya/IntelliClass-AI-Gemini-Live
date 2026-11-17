"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AVATAR_MODELS,
  getAvatarMetadata,
  validatePersonaPairing,
  type AvatarModelId,
} from "@/features/avatar";
import {
  DEFAULT_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_SPEECH_SPEED,
  DEFAULT_TTS_PROVIDER,
} from "@/config";
import { GEMINI_LIVE_VOICES } from "@/features/settings/components/VoiceSpeedControls";
import { api } from "@/lib/api";
import {
  User,
  Volume2,
  Sparkles,
  AlertTriangle,
  Lock,
  Play,
  Square,
  Gauge,
  Check,
  Globe,
  HardDrive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SessionPersonaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionStatus: string;
  isLecturer: boolean;
  currentAvatarModel: string;
  currentVoiceId: string;
  currentSpeechSpeed?: number;
  currentTtsProvider?: string;
  onSaveConfig: (config: {
    avatar_model: string;
    voice_id: string;
    speech_speed: number;
    tts_provider: string;
  }) => Promise<void>;
}

export function SessionPersonaModal({
  open,
  onOpenChange,
  sessionStatus,
  isLecturer,
  currentAvatarModel,
  currentVoiceId,
  currentSpeechSpeed = DEFAULT_SPEECH_SPEED,
  currentTtsProvider: _currentTtsProvider = DEFAULT_TTS_PROVIDER,
  onSaveConfig,
}: SessionPersonaModalProps) {
  const isLocked = sessionStatus === "running" || !isLecturer;

  // Form state
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarModelId>(
    currentAvatarModel === DEFAULT_FEMALE_AVATAR_MODEL ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_AVATAR_MODEL
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(currentVoiceId || DEFAULT_MALE_VOICE_ID);
  const [speechSpeed, setSpeechSpeed] = useState<number>(currentSpeechSpeed);

  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedAvatar(
        currentAvatarModel === "women-avatarsdk" ? "women-avatarsdk" : "men-avatarsdk"
      );
      setSelectedVoiceId(currentVoiceId || "Fenrir");
      setSpeechSpeed(typeof currentSpeechSpeed === "number" ? currentSpeechSpeed : 1.0);
    }
  }

  // Pacing category descriptor
  const speedLabel = useMemo(() => {
    if (speechSpeed <= 0.85) return "Deliberate & Articulate";
    if (speechSpeed <= 1.05) return "Standard Academic Pace";
    return "Brisk & Concise";
  }, [speechSpeed]);

  // Handle Save
  const handleSave = async () => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        avatar_model: selectedAvatar,
        voice_id: selectedVoiceId,
        speech_speed: speechSpeed,
        tts_provider: "gemini_live",
      });
      onOpenChange(false);
    } catch {
      // error handled in caller
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl space-y-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Classroom Persona & Voice Configuration
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Align your 3D lecturer identity, vocal timbre, and speech pacing before class.
                </DialogDescription>
              </div>
            </div>

            {isLocked && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" />
                <span>Locked (Live Broadcast)</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLocked && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Live Broadcast in Progress:</strong> 3D avatar persona, speech voice, and pacing cannot be modified while the lecture is actively playing. Please pause the lecture to adjust configuration.
            </p>
          </div>
        )}

        {/* ── Section 1: 3D Avatar Selection ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              1. 3D Lecturer Persona
            </label>
            <span className="text-[11px] text-muted-foreground">
              {AVATAR_MODELS.length} Production Avatars
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {AVATAR_MODELS.map((avatar) => {
              const isSelected = selectedAvatar === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setSelectedAvatar(avatar.id as AvatarModelId)}
                  className={cn(
                    "relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-muted/30",
                    isLocked && "opacity-80 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="font-bold text-sm text-foreground">{avatar.name}</span>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold",
                        avatar.gender === "female"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-blue-500/10 text-blue-500"
                      )}
                    >
                      {avatar.gender}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {avatar.description}
                  </p>

                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Speech Voice Selection ── */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-primary" />
            2. Gemini Live Neural Voice
          </label>

          {/* Voice Dropdown list */}
          <div className="relative">
            <select
              value={selectedVoiceId}
              disabled={isLocked}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className={cn(
                "w-full h-11 px-3.5 rounded-2xl border border-border/60 bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20",
                isLocked && "opacity-80 cursor-not-allowed"
              )}
            >
              {GEMINI_LIVE_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Section 3: Speech Pacing / Speed Normalizer ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              3. Speaking Pacing Preference
            </label>
            <span className="text-xs font-mono font-bold text-foreground">
              {speechSpeed.toFixed(2)}x ({speedLabel})
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={speechSpeed}
              disabled={isLocked}
              onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              className={cn(
                "w-full h-2 rounded-lg bg-muted appearance-none cursor-pointer accent-primary",
                isLocked && "cursor-not-allowed opacity-70"
              )}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>0.75x (Deliberate)</span>
              <span>1.00x (Natural)</span>
              <span>1.25x (Brisk)</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Calibrated for real-time conversational lecturing via Google Gemini Live AI audio.
          </p>
        </div>

        <DialogFooter className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-4 text-xs font-semibold"
          >
            {isLocked ? "Close" : "Cancel"}
          </Button>

          {!isLocked && isLecturer && (
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 text-xs font-semibold gap-2 shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Configuration</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
