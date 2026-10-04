"use client";

import { useState } from "react";
import { Volume2, Volume1, VolumeX, Volume } from "lucide-react";
import { setMasterVolume, getMasterVolume } from "@/features/avatar";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface VolumeControlProps {
  variant?: "card" | "menu";
}

export function VolumeControl({ variant = "menu" }: VolumeControlProps) {
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.round(getMasterVolume() * 100);
    }
    return 100;
  });
  const [prevVolume, setPrevVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return getMasterVolume() === 0;
    }
    return false;
  });

  const handleVolumeChange = (value: number[]) => {
    const newVol = value[0] ?? 100;
    setVolumeState(newVol);
    setMasterVolume(newVol / 100);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    } else if (newVol === 0 && !isMuted) {
      setIsMuted(true);
    }
  };

  const handleToggleMute = () => {
    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 80;
      setIsMuted(false);
      setVolumeState(restored);
      setMasterVolume(restored / 100);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolumeState(0);
      setMasterVolume(0);
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-4 w-4 text-red-500" />;
    if (volume < 35) return <Volume className="h-4 w-4 text-[#0071e3]" />;
    if (volume < 70) return <Volume1 className="h-4 w-4 text-[#0071e3]" />;
    return <Volume2 className="h-4 w-4 text-[#0071e3]" />;
  };

  // ── Menu Variant: Pure Apple HIG Dropdown Item Structure ──────────────────
  if (variant === "menu") {
    return (
      <div
        className="px-2.5 py-2.5 flex flex-col gap-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/10 select-none"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Row 1: Single Icon + 2-Line Label on left, Percentage Pill on right */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggleMute}
            className="flex items-center gap-2.5 text-left group min-w-0"
            title={isMuted ? "Click to unmute" : "Click to mute"}
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          >
            <span className="shrink-0">
              {getVolumeIcon()}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                Audio Volume
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {isMuted ? "Audio muted • tap to restore" : "Master avatar voice"}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="shrink-0 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title={isMuted ? "Click to unmute" : "Click to mute"}
          >
            {isMuted ? "Muted" : `${volume}%`}
          </button>
        </div>

        {/* Row 2: Smooth Apple HIG Slider indented under the label (NO duplicate icon!) */}
        <div className="pl-6.5 pr-1">
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            aria-label="Master volume level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isMuted ? 0 : volume}
            className="cursor-pointer"
          />
        </div>
      </div>
    );
  }

  // ── Card Variant: Compact horizontal Apple pill for header bars ───────────
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-[#1c1c1e]/60 backdrop-blur-xl shadow-xs text-xs font-semibold select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={handleToggleMute}
        className="h-6 w-6 text-foreground shrink-0 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
        title={isMuted ? "Unmute Audio" : "Mute Audio"}
        aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
      >
        {getVolumeIcon()}
      </Button>

      <div className="w-20 sm:w-24">
        <Slider
          value={[isMuted ? 0 : volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          aria-label="Master volume level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isMuted ? 0 : volume}
          className="cursor-pointer"
        />
      </div>

      <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">
        {isMuted ? "0%" : `${volume}%`}
      </span>
    </div>
  );
}
