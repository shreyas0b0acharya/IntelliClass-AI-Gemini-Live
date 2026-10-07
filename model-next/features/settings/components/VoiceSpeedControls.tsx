"use client";

import { Label } from "@/components/ui/label";
import { VOICE_OPTIONS, ELEVENLABS_VOICE_OPTIONS } from "../services/settings";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const filteredHeadTTS = VOICE_OPTIONS.filter((v) => v.gender === gender);
  const filteredElevenLabs = ELEVENLABS_VOICE_OPTIONS.filter((v) => v.gender === gender);

  return (
    <div className="space-y-4">
      {/* Custom Radix Select for Voice Selection */}
      <div className="space-y-2">
        <Label>
          Voice Profile &amp; Engine
        </Label>
        <Select value={voiceId} onValueChange={onVoiceChange} disabled={disabled}>
          <SelectTrigger className="w-full h-11 cursor-pointer">
            <SelectValue placeholder="Select voice profile..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-xl p-1">
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1.5">
                Local Voices (HeadTTS - Fast &amp; Offline)
              </SelectLabel>
              {filteredHeadTTS.map((v) => (
                <SelectItem
                  key={v.id}
                  value={v.id}
                  className="rounded-lg py-2 text-xs font-medium cursor-pointer"
                >
                  {v.name}
                </SelectItem>
              ))}
            </SelectGroup>
            {filteredElevenLabs.length > 0 && (
              <SelectGroup className="mt-1 pt-1 border-t border-border">
                <SelectLabel className="text-[10px] uppercase font-bold text-primary tracking-wider px-2 py-1.5 flex items-center justify-between">
                  <span>Natural Cloud (ElevenLabs)</span>
                  <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">Low Latency</span>
                </SelectLabel>
                {filteredElevenLabs.map((v) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    className="rounded-lg py-2 text-xs font-medium cursor-pointer"
                  >
                    {v.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
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
