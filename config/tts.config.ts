// model-next/config/tts.config.ts
//
// Centralized configuration for Gemini Live voice settings, calibration defaults, and pacing.

import type { TTSProviderId, VoiceOption, TTSModelOption } from "@/features/classroom/types/speech";

/**
 * Provider & Voice Defaults for Gemini Live
 */
export const DEFAULT_TTS_PROVIDER: TTSProviderId = "gemini_live";
export const DEFAULT_MALE_VOICE_ID = "Charon";
export const DEFAULT_FEMALE_VOICE_ID = "Aoede";

export const DEFAULT_SPEECH_SPEED = 1.0;

export const SPEECH_SPEED_LIMITS = {
  MIN: 0.70,
  MAX: 1.50,
} as const;

export const DEFAULT_CALIBRATED_SPEED: Record<string, number> = {
  gemini_live: 1.0,
};

export const PROVIDER_BASELINE_SPEED = DEFAULT_CALIBRATED_SPEED;

/**
 * Official Gemini Live Neural Audio Voices
 */
export const GEMINI_LIVE_VOICES: VoiceOption[] = [
  {
    id: "Charon",
    name: "Charon",
    provider: "gemini_live",
    gender: "male",
    description: "Deep, authoritative and distinctly masculine professor voice",
    category: "system",
  },
  {
    id: "Puck",
    name: "Puck",
    provider: "gemini_live",
    gender: "male",
    description: "Clear, engaging and energetic academic professor voice",
    category: "system",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    provider: "gemini_live",
    gender: "male",
    description: "Articulate academic lecture voice",
    category: "system",
  },
  {
    id: "Aoede",
    name: "Aoede",
    provider: "gemini_live",
    gender: "female",
    description: "Warm, expressive and engaging lecturer voice",
    category: "system",
  },
  {
    id: "Kore",
    name: "Kore",
    provider: "gemini_live",
    gender: "female",
    description: "Dynamic, bright conversational voice",
    category: "system",
  },
];

export const VOICE_OPTIONS = GEMINI_LIVE_VOICES;
export const HEADTTS_VOICE_OPTIONS = GEMINI_LIVE_VOICES;
export const ELEVENLABS_OFFLINE_FALLBACK_VOICES = GEMINI_LIVE_VOICES;

export const TTS_MODELS: TTSModelOption[] = [
  {
    id: "gemini-3.8-live",
    name: "Gemini 3.8 Live",
    provider: "gemini_live",
    description: "Full-duplex real-time bidirectional multimodal audio model",
    isDefault: true,
  },
];
