// model-next/features/classroom/constants/voices.ts
//
// Authoritative fallback lists for voices and TTS models.
// Safe for both client and server (no "use client" directive or React hooks).

import type { VoiceOption, TTSModelOption } from "../types/speech";

export const TTS_MODELS: TTSModelOption[] = [
  {
    id: "kokoro-82m-onnx",
    name: "Kokoro 82M ONNX",
    provider: "headtts",
    description: "Local neural Kokoro model for zero-cost, offline academic speech.",
    isDefault: true,
  },
  {
    id: "eleven_flash_v2_5",
    name: "Eleven Flash v2.5",
    provider: "elevenlabs",
    description: "Ultra-low latency (~75ms engine) cloud model with character timestamp alignment.",
    isDefault: true,
  },
  {
    id: "eleven_multilingual_v2",
    name: "Eleven Multilingual v2",
    provider: "elevenlabs",
    description: "Rich emotional depth and multilingual support across 29 languages.",
  },
];

/**
 * Available neural Kokoro voice models inside HeadTTS
 */
export const HEADTTS_VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "am_fenrir",
    name: "Fenrir (Male, Deep & Academic)",
    provider: "headtts",
    gender: "male",
    accent: "American",
    description: "Deep, calm, academic pace (Local Kokoro)",
  },
  {
    id: "af_bella",
    name: "Bella (Female, Articulate & Engaging)",
    provider: "headtts",
    gender: "female",
    accent: "American",
    description: "Articulate, clear, engaging cadence (Local Kokoro)",
  },
];

/**
 * Curated ElevenLabs fallback voice models with authoritative metadata
 */
export const ELEVENLABS_VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah (Female, Professional Lecturer)",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    useCase: "informative_educational",
    category: "premade",
    description: "Mature, reassuring, confident academic delivery",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice (Female, Engaging Educator)",
    provider: "elevenlabs",
    gender: "female",
    accent: "British",
    useCase: "informative_educational",
    category: "premade",
    description: "Clear, engaging, articulate British educator",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian (Male, Deep & Academic)",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    category: "premade",
    description: "Deep, resonant, scholarly cadence",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam (Male, Firm & Authoritative)",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    category: "premade",
    description: "Authoritative, firm, clear presentation voice",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica (Female, Playful & Warm)",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    useCase: "conversational",
    category: "premade",
    description: "Bright, engaging, warm delivery",
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda (Female, Professional & Articulate)",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    useCase: "informative_educational",
    category: "premade",
    description: "Knowledgeable, professional, scholarly tone",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George (Male, Warm Storyteller)",
    provider: "elevenlabs",
    gender: "male",
    accent: "British",
    useCase: "narration",
    category: "premade",
    description: "Warm, captivating, British cadence",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam (Male, Energetic & Direct)",
    provider: "elevenlabs",
    gender: "male",
    accent: "American",
    useCase: "conversational",
    category: "premade",
    description: "Energetic, clear, and modern presentation style",
  },
];

export const ALL_DEFAULT_VOICE_OPTIONS: VoiceOption[] = [
  ...HEADTTS_VOICE_OPTIONS,
  ...ELEVENLABS_VOICE_OPTIONS,
];
