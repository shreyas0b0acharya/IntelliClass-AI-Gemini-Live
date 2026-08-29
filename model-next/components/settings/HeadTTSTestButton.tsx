"use client";

import { useState } from "react";
import { AppButton } from "@/components/app/AppButton";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";
import { Volume2, Square } from "lucide-react";
import { unlockAudioContext } from "@/components/LipSync/audioManager";
import { toast } from "sonner";

interface HeadTTSTestButtonProps {
  text: string;
  voice: string;
  speed: number;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  onDataReceived: (audioPath: string | undefined, lipSyncData: HeadTTSData | undefined) => void;
  className?: string;
}

export function HeadTTSTestButton({
  text,
  voice,
  speed,
  isPlaying,
  onPlayStateChange,
  onDataReceived,
  className = "w-full h-11 font-medium text-xs shadow-2xs",
}: HeadTTSTestButtonProps) {
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleToggle = async () => {
    // 1. Immediately unlock browser Web Audio pipeline on user click gesture
    unlockAudioContext();

    if (isPlaying) {
      onPlayStateChange(false);
      onDataReceived(undefined, undefined);
      return;
    }

    if (!text.trim()) {
      toast.error("Please provide prompt text to preview.");
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice,
          speed,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "HeadTTS service error" }));
        throw new Error(err.error || "Failed to synthesize preview from HeadTTS.");
      }

      const data = await res.json();
      onDataReceived(data.audioPath, data.lipSyncData);
      onPlayStateChange(true);
    } catch (err: unknown) {
      console.error("HeadTTS synthesis error:", err);
      const msg = err instanceof Error ? err.message : "HeadTTS audio synthesis failed.";
      toast.error(msg);
      onPlayStateChange(false);
      onDataReceived(undefined, undefined);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <AppButton
      type="button"
      onClick={handleToggle}
      disabled={isSynthesizing}
      isLoading={isSynthesizing}
      loadingText="Synthesizing HeadTTS Voice..."
      variant={isPlaying ? "destructive" : "secondary"}
      shape="pill"
      className={className}
      leftIcon={
        !isSynthesizing ? (
          isPlaying ? (
            <Square className="h-3 w-3 fill-current" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-[#0071e3]" />
          )
        ) : undefined
      }
    >
      <span>{isPlaying ? "Stop Preview" : "Test HeadTTS Voice & LipSync"}</span>
    </AppButton>
  );
}
