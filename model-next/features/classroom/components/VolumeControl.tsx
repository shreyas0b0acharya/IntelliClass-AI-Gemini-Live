"use client";

import { useState, useEffect } from "react";
import { Volume2, Volume1, VolumeX, Volume } from "lucide-react";
import { setMasterVolume, getMasterVolume } from "@/components/LipSync/audioManager";
import { Slider } from "@/components/ui/slider";

export function VolumeControl() {
  const [volume, setVolumeState] = useState<number>(100);
  const [prevVolume, setPrevVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    const current = Math.round(getMasterVolume() * 100);
    setVolumeState(current);
    if (current === 0) setIsMuted(true);
  }, []);

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
    if (isMuted || volume === 0) return <VolumeX className="h-3.5 w-3.5 text-red-500" />;
    if (volume < 35) return <Volume className="h-3.5 w-3.5 text-[#0071e3]" />;
    if (volume < 70) return <Volume1 className="h-3.5 w-3.5 text-[#0071e3]" />;
    return <Volume2 className="h-3.5 w-3.5 text-[#0071e3]" />;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-xs text-xs font-semibold select-none">
      <button
        type="button"
        onClick={handleToggleMute}
        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-foreground cursor-pointer shrink-0"
        title={isMuted ? "Unmute Audio" : "Mute Audio"}
      >
        {getVolumeIcon()}
      </button>

      <div className="w-20 sm:w-24">
        <Slider
          value={[isMuted ? 0 : volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          className="cursor-pointer"
        />
      </div>

      <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">
        {isMuted ? "0%" : `${volume}%`}
      </span>
    </div>
  );
}
