// model-next/features/classroom/constants/voices.ts
//
// Legacy constants module re-exporting from central @/config/tts.config.
// Preserves 100% backward-compatibility across all classroom and session modules.

import {
  TTS_MODELS,
  HEADTTS_VOICE_OPTIONS,
  ELEVENLABS_OFFLINE_FALLBACK_VOICES,
} from "@/config";
import type { VoiceOption, TTSModelOption } from "../types/speech";

export { TTS_MODELS, HEADTTS_VOICE_OPTIONS };

// Legacy aliases mapped to central config fallbacks
export const ELEVENLABS_VOICE_OPTIONS: VoiceOption[] = ELEVENLABS_OFFLINE_FALLBACK_VOICES;

export const ALL_DEFAULT_VOICE_OPTIONS: VoiceOption[] = [
  ...HEADTTS_VOICE_OPTIONS,
  ...ELEVENLABS_OFFLINE_FALLBACK_VOICES,
];
