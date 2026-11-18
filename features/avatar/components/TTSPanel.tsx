"use client";

import { useState } from "react";
import type { HeadTTSData } from "../types/lipSync.types";
import { unlockAudioContext } from "../services/audioManager";
import { HEADTTS_VOICE_OPTIONS, DEFAULT_FEMALE_VOICE_ID } from "@/config";

interface TTSResult {
  audioPath: string;
  lipSyncData: HeadTTSData;
}

interface TTSPanelProps {
  onSpeakText: (text: string, voice?: string) => void;
  onStop?: () => void;
  isSpeaking?: boolean;
  isGenerating?: boolean;
  statusText?: string;
  onGenerated?: (result: TTSResult) => void;
  disabled?: boolean;
}

const KOKORO_VOICES = HEADTTS_VOICE_OPTIONS.map((v) => ({
  id: v.id,
  label: v.name,
}));

export function TTSPanel({
  onSpeakText,
  onStop,
  isSpeaking = false,
  isGenerating = false,
  statusText = "",
  disabled = false,
}: TTSPanelProps) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(DEFAULT_FEMALE_VOICE_ID);

  const handleSpeak = () => {
    const value = text.trim();
    if (!value || isGenerating || disabled) {
      return;
    }
    unlockAudioContext();
    onSpeakText(value, voice);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSpeak();
    }
  };

  const isActive = isSpeaking || isGenerating;

  return (
    <div className="flex w-80 flex-col gap-2 rounded-lg bg-white p-3 shadow-lg">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Voice Persona</label>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          disabled={isActive || disabled}
          className="rounded-md border p-1.5 text-xs outline-none focus:border-black disabled:bg-muted"
        >
          {KOKORO_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter text for the avatar to say..."
        rows={4}
        disabled={isActive || disabled}
        className="resize-none rounded-md border p-2 text-sm outline-none focus:border-black disabled:bg-muted"
      />

      {isActive ? (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onStop}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive active:bg-destructive"
          >
            ⏹ Stop Speech
          </button>
          {statusText && (
            <div className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 p-2 rounded border border-primary/20">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-primary" />
              <span>{statusText}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSpeak}
          disabled={!text.trim() || disabled}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-muted disabled:opacity-50"
        >
          Speak Text
        </button>
      )}
    </div>
  );
}

export default TTSPanel;
