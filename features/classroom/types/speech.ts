import type { LipSyncData } from "@/features/avatar";

export type TTSProviderId = "gemini_live" | "headtts" | "elevenlabs";

export type VoiceGender = "male" | "female" | "unknown";

export interface VoiceOption {
  id: string;
  name: string;
  provider: TTSProviderId;
  gender: VoiceGender;
  accent?: string;
  age?: string;
  useCase?: string;
  category?: string; // e.g. "premade" | "cloned" | "system"
  description?: string;
}

export interface TTSModelOption {
  id: string;
  name: string;
  provider: TTSProviderId;
  description: string;
  isDefault?: boolean;
}

export interface SessionPersonaConfig {
  avatarModel: "men-avatarsdk" | "women-avatarsdk";
  ttsProvider: TTSProviderId;
  voiceId: string;
  modelId?: string;
  speechSpeed: number; // User pacing preference (e.g. 1.0)
}

export type SpeechStatus =
  | "idle"
  | "prefetching"
  | "generating"
  | "ready"
  | "playing"
  | "error"
  | "cancelled";

export interface ElevenLabsVoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export interface SpeechItem {
  requestId: string; // Unique per playback/request invocation
  cacheKey: string; // Deterministic hash(text + voice + settings)
  text: string;
  audioUrl: string;
  audioPath: string; // Compatibility alias
  durationMs: number;
  lipSyncData: LipSyncData;
  provider?: TTSProviderId;
  modelId?: string;
  voiceId?: string;
  alignmentSource?: "headtts" | "elevenlabs";
  timingVersion?: number;
  cached?: boolean;
  targetEpochMs?: number;
  sequence?: number;
}

// Canonical SpeechResult alias
export type SpeechResult = SpeechItem;

export interface TTSFetchOptions {
  text: string;
  voice?: string;
  provider?: TTSProviderId;
  modelId?: string;
  speed?: number;
  voiceSettings?: ElevenLabsVoiceSettings;
  requestId?: string;
  signal?: AbortSignal;
}
