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
import type { VoiceOption, TTSModelOption, TTSProviderId, VoiceGender } from "@/features/classroom/types/speech";
import { ALL_DEFAULT_VOICE_OPTIONS } from "@/features/classroom/constants/voices";
import {
  DEFAULT_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_SPEECH_SPEED,
  DEFAULT_TTS_PROVIDER,
  SPEECH_SPEED_LIMITS,
  TTS_MODELS,
  getVoicePreviewPhrase,
} from "@/config";
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
  currentTtsProvider = DEFAULT_TTS_PROVIDER,
  onSaveConfig,
}: SessionPersonaModalProps) {
  const isLocked = sessionStatus === "running" || !isLecturer;

  // Form state
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarModelId>(
    currentAvatarModel === DEFAULT_FEMALE_AVATAR_MODEL ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_AVATAR_MODEL
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(currentVoiceId || DEFAULT_MALE_VOICE_ID);
  const [speechSpeed, setSpeechSpeed] = useState<number>(currentSpeechSpeed);
  const [providerFilter, setProviderFilter] = useState<"all" | "elevenlabs" | "headtts">("all");

  // Dynamic voices and models from server
  const [voices, setVoices] = useState<VoiceOption[]>(ALL_DEFAULT_VOICE_OPTIONS);
  const [models, setModels] = useState<TTSModelOption[]>(TTS_MODELS);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Audio test playback state
  const [testingAudio, setTestingAudio] = useState(false);
  const [testAudioElement, setTestAudioElement] = useState<HTMLAudioElement | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedAvatar(
        currentAvatarModel === DEFAULT_FEMALE_AVATAR_MODEL ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_AVATAR_MODEL
      );
      setSelectedVoiceId(currentVoiceId || DEFAULT_MALE_VOICE_ID);
      setSpeechSpeed(typeof currentSpeechSpeed === "number" ? currentSpeechSpeed : DEFAULT_SPEECH_SPEED);
    }
  }, [open, currentAvatarModel, currentVoiceId, currentSpeechSpeed]);

  // Clean up test audio on unmount or close
  useEffect(() => {
    if (!open && testAudioElement) {
      testAudioElement.pause();
      setTestAudioElement(null);
      setTestingAudio(false);
    }
  }, [open, testAudioElement]);

  // Load dynamic voices on mount or when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadVoices() {
      setLoadingVoices(true);
      try {
        const res = await api.getTTSVoices();
        if (!cancelled && res.voices && res.voices.length > 0) {
          setVoices(res.voices);
          if (res.models) setModels(res.models);
        }
      } catch (err) {
        console.warn("[PersonaModal] Could not fetch dynamic voices, using defaults:", err);
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    }

    loadVoices();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Selected voice metadata lookup
  const selectedVoiceMeta = useMemo(() => {
    return voices.find((v) => v.id === selectedVoiceId) || voices[0] || ALL_DEFAULT_VOICE_OPTIONS[0];
  }, [voices, selectedVoiceId]);

  // Filtered voice list
  const filteredVoices = useMemo(() => {
    if (providerFilter === "all") return voices;
    return voices.filter((v) => v.provider === providerFilter);
  }, [voices, providerFilter]);

  // Validation: unknown gender NEVER triggers mismatch warning
  const pairingValidation = useMemo(() => {
    return validatePersonaPairing(
      selectedAvatar,
      selectedVoiceMeta?.gender || "unknown",
      selectedVoiceMeta?.name
    );
  }, [selectedAvatar, selectedVoiceMeta]);

  // Pacing category descriptor
  const speedLabel = useMemo(() => {
    if (speechSpeed <= 0.85) return "Deliberate & Articulate";
    if (speechSpeed <= 1.05) return "Standard Academic Pace";
    return "Brisk & Concise";
  }, [speechSpeed]);

  // Handle Quick-Fixes
  const handleQuickFixAvatar = (newAvatarId?: AvatarModelId) => {
    if (newAvatarId) {
      setSelectedAvatar(newAvatarId);
      toast.success(`Switched avatar to ${newAvatarId === DEFAULT_FEMALE_AVATAR_MODEL ? "Dr. Clara" : "Prof. Arthur"}`);
    }
  };

  const handleQuickFixVoice = () => {
    const avatarMeta = getAvatarMetadata(selectedAvatar);
    const matchingVoice = voices.find((v) => v.gender === avatarMeta.gender);
    if (matchingVoice) {
      setSelectedVoiceId(matchingVoice.id);
      toast.success(`Selected matching ${avatarMeta.gender} voice: ${matchingVoice.name}`);
    }
  };

  // Test Speech Playback
  const handleTestVoice = async () => {
    if (testingAudio) {
      if (testAudioElement) {
        testAudioElement.pause();
        setTestAudioElement(null);
      }
      setTestingAudio(false);
      return;
    }

    setTestingAudio(true);
    const avatarName = selectedAvatar === DEFAULT_FEMALE_AVATAR_MODEL ? "Dr. Clara" : "Prof. Arthur";
    const sampleText = getVoicePreviewPhrase(avatarName);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleText,
          voice: selectedVoiceId,
          provider: selectedVoiceMeta.provider,
          speed: speechSpeed,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS sample preview failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.audioPath) {
        throw new Error("Invalid TTS audio returned.");
      }

      const audio = new Audio(data.audioPath);
      audio.onended = () => {
        setTestingAudio(false);
        setTestAudioElement(null);
      };
      audio.onerror = () => {
        setTestingAudio(false);
        setTestAudioElement(null);
        toast.error("Audio playback error during preview.");
      };

      setTestAudioElement(audio);
      await audio.play();
    } catch (err: unknown) {
      setTestingAudio(false);
      const msg = err instanceof Error ? err.message : "Preview error";
      toast.error(msg);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        avatar_model: selectedAvatar,
        voice_id: selectedVoiceId,
        speech_speed: speechSpeed,
        tts_provider: selectedVoiceMeta.provider,
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              2. Vocal Cadence & Voice Model
            </label>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/40 border border-border/40 text-[11px]">
              <button
                type="button"
                onClick={() => setProviderFilter("all")}
                className={cn(
                  "px-2 py-0.5 rounded-md font-medium transition-colors",
                  providerFilter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setProviderFilter("elevenlabs")}
                className={cn(
                  "px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1",
                  providerFilter === "elevenlabs" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                <Globe className="h-2.5 w-2.5 text-blue-500" /> Cloud
              </button>
              <button
                type="button"
                onClick={() => setProviderFilter("headtts")}
                className={cn(
                  "px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1",
                  providerFilter === "headtts" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                <HardDrive className="h-2.5 w-2.5 text-emerald-500" /> Local
              </button>
            </div>
          </div>

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
              {filteredVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.provider === "elevenlabs" ? "ElevenLabs Cloud" : "HeadTTS Local"} • {voice.gender.toUpperCase()}{voice.accent ? ` • ${voice.accent}` : ""})
                </option>
              ))}
            </select>
            {loadingVoices && (
              <div className="absolute right-3 top-3 pointer-events-none text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {/* Voice Details Badge */}
          {selectedVoiceMeta && (
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/40 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {selectedVoiceMeta.name}
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase",
                      selectedVoiceMeta.gender === "female"
                        ? "bg-rose-500/10 text-rose-500"
                        : selectedVoiceMeta.gender === "male"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {selectedVoiceMeta.gender}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {selectedVoiceMeta.provider === "elevenlabs" ? "Cloud Ultra-Low Latency" : "Kokoro Neural 82M"}
                </span>
              </div>
              {selectedVoiceMeta.description && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {selectedVoiceMeta.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Mismatch Validation Banner (Unknown gender NEVER triggers warning) ── */}
        {!pairingValidation.isMatch && pairingValidation.warningMessage && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold">Persona & Voice Mismatch Detected</p>
                <p className="text-[11px] leading-relaxed">
                  {pairingValidation.warningMessage}
                </p>
              </div>
            </div>

            {!isLocked && (
              <div className="flex items-center gap-2 pt-1">
                {pairingValidation.quickFixAvatarId && (
                  <button
                    type="button"
                    onClick={() => handleQuickFixAvatar(pairingValidation.quickFixAvatarId)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 text-white dark:bg-amber-500 text-[11px] font-bold hover:opacity-90 transition-opacity"
                  >
                    Switch to {pairingValidation.quickFixAvatarId === DEFAULT_FEMALE_AVATAR_MODEL ? "Dr. Clara" : "Prof. Arthur"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleQuickFixVoice}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-500/30 transition-colors"
                >
                  Pick Matching Voice
                </button>
              </div>
            )}
          </div>
        )}

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
            {selectedVoiceMeta.provider === "elevenlabs"
              ? "Provider Calibration: ElevenLabs synthesizes proportionally around a 0.90x baseline for clear classroom cadence."
              : "Provider Calibration: HeadTTS executes at native 1.0x neural pacing."}
          </p>
        </div>

        {/* ── Section 4: Live Audio Preview & Tester ── */}
        <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Sample Lecture Greeting</p>
              <p className="text-[10px] text-muted-foreground">Test vocal tone and pacing preview</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestVoice}
            disabled={loadingVoices}
            className="h-8 px-3.5 text-xs font-semibold gap-1.5"
          >
            {testingAudio ? (
              <>
                <Square className="h-3 w-3 fill-current text-rose-500" />
                <span>Stop Sample</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current text-primary" />
                <span>Test Voice</span>
              </>
            )}
          </Button>
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
