// model-next/config/tts.config.ts
//
// Centralized configuration for Text-To-Speech providers, calibration defaults, and API limits.
// Safe for both client and server (pure isomorphic data; API keys remain strictly in server process.env).

import type { TTSProviderId, VoiceOption, TTSModelOption } from "@/features/classroom/types/speech";

/**
 * Provider & Model Defaults
 */
export const DEFAULT_TTS_PROVIDER: TTSProviderId = "headtts";
export const DEFAULT_MALE_VOICE_ID = "am_fenrir";
export const DEFAULT_FEMALE_VOICE_ID = "af_bella";
export const DEFAULT_ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah (free premade)
export const ELEVENLABS_FALLBACK_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel (free premade)
export const DEFAULT_HEADTTS_MODEL_ID = "kokoro-82m-onnx";
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_flash_v2_5"; // Ultra low-latency interactive model

/**
 * Speed & Pacing Calibration
 */
export const DEFAULT_SPEECH_SPEED = 1.0;

export const SPEECH_SPEED_LIMITS = {
  MIN: 0.70,
  MAX: 1.20,
} as const;

/**
 * Starting preset calibration factor per provider for articulate academic pace.
 * Used as an initial calibrated baseline rather than a universal override.
 */
export const DEFAULT_CALIBRATED_SPEED: Record<TTSProviderId, number> = {
  headtts: 1.0,
  elevenlabs: 0.90,
};

export const PROVIDER_BASELINE_SPEED = DEFAULT_CALIBRATED_SPEED;


/**
 * ElevenLabs Cloud API Network Configuration
 */
export const ELEVENLABS_API_CONFIG = {
  BASE_URL: "https://api.elevenlabs.io/v1",
  LIVE_TIMEOUT_MS: 8000,        // Tight timeout for live classroom to quickly fail over to HeadTTS
  PREGENERATE_TIMEOUT_MS: 25000, // Generous timeout for batch pre-generating lecture scripts
} as const;

/**
 * Local Generated Audio File Storage & Cache Policy
 */
export const AUDIO_STORAGE_CONFIG = {
  directory: "public/generated/audio",
  metadataExtension: ".json",
  immutableCache: true,
  cacheMaxAgeSeconds: 86400,
} as const;

/**
 * Standard TTS Model Catalog
 */
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
    description: "Rich emotional depth and multilingual stability across 29 languages.",
  },
];

/**
 * Local Kokoro Voices inside HeadTTS
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
 * Emergency offline ElevenLabs fallback list (used ONLY if GET /api/tts/voices is unreachable).
 * Live metadata from /api/tts/voices remains the authoritative source.
 */
export const ELEVENLABS_OFFLINE_FALLBACK_VOICES: VoiceOption[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah (Female, Professional Lecturer)",
    provider: "elevenlabs",
    gender: "female",
    accent: "American",
    useCase: "informative_educational",
    category: "premade",
    description: "Clear, authoritative academic delivery",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice (Female, Clear Educator)",
    provider: "elevenlabs",
    gender: "female",
    accent: "British",
    useCase: "informative_educational",
    category: "premade",
    description: "Articulate, pleasant, standard British presenter",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica (Female, Engaging & Bright)",
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

/**
 * Standard speech preview phrase template
 */
export function getVoicePreviewPhrase(personaName: string = "Professor"): string {
  return `Hello class, I am ${personaName}. Welcome to our lecture today. Let us explore the core concepts together.`;
}
