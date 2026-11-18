"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const GEMINI_LIVE_VOICES = [
  { id: "Puck", name: "Puck (Male, Clear & Engaging)", gender: "male" },
  { id: "Fenrir", name: "Fenrir (Male, Deep & Academic)", gender: "male" },
  { id: "Charon", name: "Charon (Neutral, Calm & Intellectual)", gender: "male" },
  { id: "Aoede", name: "Aoede (Female, Warm & Expressive)", gender: "female" },
  { id: "Kore", name: "Kore (Female, Gentle & Clear)", gender: "female" },
];

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
  // Map any legacy IDs to Gemini Live voices
  let normalizedVoiceId = voiceId;
  if (voiceId === "am_fenrir" || !voiceId) normalizedVoiceId = gender === "male" ? "Charon" : "Aoede";
  if (voiceId === "af_bella") normalizedVoiceId = "Aoede";

  const filteredVoices = GEMINI_LIVE_VOICES.filter((v) => v.gender === gender);

  return (
    <div className="space-y-4">
      {/* Voice Selection */}
      <div className="space-y-2">
        <Label>Gemini Live Voice Profile</Label>
        <Select
          value={normalizedVoiceId}
          onValueChange={onVoiceChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full h-11 cursor-pointer">
            <SelectValue placeholder="Select Gemini Live voice..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-xl p-1">
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-bold text-primary tracking-wider px-2 py-1.5">
                Gemini Live Neural Audio
              </SelectLabel>
              {filteredVoices.map((v) => (
                <SelectItem
                  key={v.id}
                  value={v.id}
                  className="rounded-lg py-2 text-xs font-medium cursor-pointer"
                >
                  {v.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Speech Pace */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Speech Pace</Label>
          <span className="font-mono text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full text-xs">
            {speed.toFixed(2)}x
          </span>
        </div>

        <div className="bg-black/5 dark:bg-white/10 p-1 rounded-xl flex gap-1">
          {SPEED_PRESETS.map((preset) => {
            const isSelected = Math.abs(speed - preset.value) < 0.05;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                onClick={() => onSpeedChange(preset.value)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${isSelected
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
