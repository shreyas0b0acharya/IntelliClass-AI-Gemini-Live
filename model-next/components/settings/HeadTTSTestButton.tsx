"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";
import { Volume2, Square, Loader2 } from "lucide-react";
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
  className = "w-full rounded-full h-11 font-medium text-xs shadow-2xs cursor-pointer gap-2",
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
    <Button
      type="button"
      onClick={handleToggle}
      disabled={isSynthesizing}
      variant="outline"
      className={`${className} ${
        isPlaying
          ? "bg-amber-500 hover:bg-amber-600 text-white border-transparent"
          : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-[#f5f5f7] border-transparent"
      }`}
    >
      {isSynthesizing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0071e3]" />
          <span>Synthesizing HeadTTS Voice...</span>
        </>
      ) : isPlaying ? (
        <>
          <Square className="h-3 w-3 fill-current" />
          <span>Stop Preview</span>
        </>
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5 text-[#0071e3]" />
          <span>Test HeadTTS Voice &amp; LipSync</span>
        </>
      )}
    </Button>
  );
}
