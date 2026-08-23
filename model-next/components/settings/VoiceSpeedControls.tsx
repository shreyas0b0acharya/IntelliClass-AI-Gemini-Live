"use client";

import { Label } from "@/components/ui/label";
import { VOICE_OPTIONS } from "@/lib/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VoiceSpeedControlsProps {
  gender: "male" | "female";
  voiceId: string;
  onVoiceChange: (voice: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
}

const SPEED_PRESETS = [
  { label: "0.75x", value: 0.75 },
  { label: "1.0x (Normal)", value: 1.0 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
];

export function VoiceSpeedControls({
  gender,
  voiceId,
  onVoiceChange,
  speed,
  onSpeedChange,
  disabled = false,
}: VoiceSpeedControlsProps) {
  const filteredVoices = VOICE_OPTIONS.filter((v) => v.gender === gender);

  return (
    <div className="space-y-4">
      {/* Custom Radix Select for Voice Selection */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
          HeadTTS Voice Profile
        </Label>
        <Select value={voiceId} onValueChange={onVoiceChange} disabled={disabled}>
          <SelectTrigger className="w-full h-11 px-4 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border-black/10 dark:border-white/10 text-sm font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:ring-1 focus:ring-[#0071e3] cursor-pointer shadow-2xs">
            <SelectValue placeholder="Select voice profile..." />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl p-1">
            {filteredVoices.map((v) => (
              <SelectItem
                key={v.id}
                value={v.id}
                className="rounded-xl py-2.5 text-xs font-semibold cursor-pointer focus:bg-[#0071e3]/10 focus:text-[#0071e3]"
              >
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* macOS Native Segmented Control for Speech Pace */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
            Speech Pace
          </Label>
          <span className="font-mono text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10 dark:bg-[#0071e3]/20 px-2 py-0.5 rounded-full">
            {speed.toFixed(2)}x
          </span>
        </div>

        {/* Apple HIG Segmented Control */}
        <div className="bg-black/5 dark:bg-white/10 p-1 rounded-xl flex gap-1">
          {SPEED_PRESETS.map((preset) => {
            const isSelected = Math.abs(speed - preset.value) < 0.05;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                onClick={() => onSpeedChange(preset.value)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${
                  isSelected
                    ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-xs"
                    : "text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
