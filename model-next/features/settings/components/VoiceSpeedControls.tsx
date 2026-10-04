"use client";

import { Label } from "@/components/ui/label";
import { VOICE_OPTIONS } from "../services/settings";
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
 <Label className="">
          HeadTTS Voice Profile
        </Label>
        <Select value={voiceId} onValueChange={onVoiceChange} disabled={disabled}>
 <SelectTrigger className="w-full h-11 cursor-pointer ">
            <SelectValue placeholder="Select voice profile..." />
          </SelectTrigger>
 <SelectContent className="">
            {filteredVoices.map((v) => (
              <SelectItem
                key={v.id}
                value={v.id}
 className=" cursor-pointer "
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
 <Label className="">
            Speech Pace
          </Label>
 <span className="font-mono text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full">
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
                    ? "bg-white dark:bg-muted text-foreground dark:text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-white"
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

export default VoiceSpeedControls;
