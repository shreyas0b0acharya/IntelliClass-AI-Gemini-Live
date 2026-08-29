import type { HeadTTSData } from "@/features/avatar";

export type SpeechStatus =
  | "idle"
  | "prefetching"
  | "generating"
  | "ready"
  | "playing"
  | "error"
  | "cancelled";

export interface SpeechItem {
  requestId: string; // Unique per playback/request invocation
  cacheKey: string; // Deterministic hash(text + voice + settings)
  text: string;
  audioUrl: string;
  audioPath: string; // Compatibility alias
  durationMs: number;
  lipSyncData: HeadTTSData;
  cached?: boolean;
}

export interface TTSFetchOptions {
  text: string;
  voice?: string;
  requestId?: string;
  signal?: AbortSignal;
}
