// model-next/lib/tts/ttsProviders.ts
//
// Dual-provider synthesis engine orchestrating HeadTTS and ElevenLabs.
// Enforces immutable local file caching, pre-broadcast fallback, and
// canonical SpeechResult construction for /api/media streaming.

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { LipSyncData } from "@/features/avatar";
import type { TTSProviderId, SpeechResult, ElevenLabsVoiceSettings } from "@/features/classroom/types/speech";
import {
  ElevenLabsAlignmentToVisemeAdapter,
  TIMING_ALGORITHM_VERSION,
  VISEME_MAPPING_VERSION,
  type ElevenLabsAlignment,
} from "./ElevenLabsAlignmentToVisemeAdapter";
import { SPEECH_PREPROCESSOR_VERSION, SpeechPreprocessor } from "./SpeechPreprocessor";
import {
  DEFAULT_TTS_PROVIDER,
  DEFAULT_SPEECH_SPEED,
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_FALLBACK_VOICE_ID,
  DEFAULT_HEADTTS_MODEL_ID,
  DEFAULT_ELEVENLABS_MODEL_ID,
  DEFAULT_CALIBRATED_SPEED,
  SPEECH_SPEED_LIMITS,
  ELEVENLABS_API_CONFIG,
} from "@/config";

export interface TTSCacheKeyParams {
  provider: TTSProviderId;
  modelId: string;
  voiceId: string;
  speed: number;
  voiceSettings?: Record<string, unknown>;
  normalizedText: string;
  speechPreprocessorVersion?: number;
  timingAlgorithmVersion?: number;
  visemeMappingVersion?: number;
}

/**
 * Deterministic, versioned hash ensuring immutable caching across pipeline iterations.
 */
export function generateTTSCacheKey(params: TTSCacheKeyParams): string {
  const payload = JSON.stringify({
    p: params.provider,
    m: params.modelId,
    v: params.voiceId,
    spd: Number(params.speed.toFixed(2)),
    s: params.voiceSettings || {},
    t: params.normalizedText.trim(),
    spv: params.speechPreprocessorVersion ?? SPEECH_PREPROCESSOR_VERSION,
    tav: params.timingAlgorithmVersion ?? TIMING_ALGORITHM_VERSION,
    vmv: params.visemeMappingVersion ?? VISEME_MAPPING_VERSION,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

export interface SynthesisOptions {
  text: string;
  voice?: string;
  provider?: TTSProviderId;
  modelId?: string;
  speed?: number;
  voiceSettings?: ElevenLabsVoiceSettings;
  requestId?: string;
  signal?: AbortSignal;
}

export interface ProviderSynthesisOutput {
  audioBuffer: Buffer;
  audioExt: "mp3" | "wav";
  durationMs: number;
  lipSyncData: LipSyncData;
  provider: TTSProviderId;
  modelId: string;
  voiceId: string;
  alignmentSource: "headtts" | "elevenlabs";
  timingVersion: number;
}

export interface ITTSServiceProvider {
  synthesize(
    text: string,
    voiceId: string,
    speed: number,
    options?: { modelId?: string; voiceSettings?: ElevenLabsVoiceSettings; signal?: AbortSignal }
  ): Promise<ProviderSynthesisOutput>;
}

// ─────────────────────────────────────────────
// 1. Local HeadTTS Provider (Port 8882)
// ─────────────────────────────────────────────

export class HeadTTSProvider implements ITTSServiceProvider {
  async synthesize(
    text: string,
    voiceId: string = "af_bella",
    speed: number = 1.0,
    options?: { signal?: AbortSignal }
  ): Promise<ProviderSynthesisOutput> {
    const headTTSUrl = process.env.HEADTTS_URL ?? "http://127.0.0.1:8882/v1/synthesize";

    const response = await fetch(headTTSUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: text,
        voice: voiceId,
        language: "en-us",
        speed,
        audioEncoding: "wav",
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HeadTTS synthesis failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.audio || !Array.isArray(data.visemes) || !Array.isArray(data.vtimes)) {
      throw new Error("HeadTTS returned invalid audio or viseme structure.");
    }

    const audioBuffer = Buffer.from(data.audio, "base64");

    let durationMs = 0;
    if (data.vtimes.length > 0 && data.vdurations.length > 0) {
      const last = data.vtimes.length - 1;
      durationMs = Math.round(data.vtimes[last] + data.vdurations[last]);
    }

    const lipSyncData: LipSyncData = {
      visemes: data.visemes,
      vtimes: data.vtimes,
      vdurations: data.vdurations,
      phonemes: data.phonemes,
      words: data.words,
      wtimes: data.wtimes,
      wdurations: data.wdurations,
    };

    return {
      audioBuffer,
      audioExt: "wav",
      durationMs,
      lipSyncData,
      provider: "headtts",
      modelId: "kokoro-82m-onnx",
      voiceId,
      alignmentSource: "headtts",
      timingVersion: 1,
    };
  }
}

// ─────────────────────────────────────────────
// 2. Cloud ElevenLabs Provider (with-timestamps)
// ─────────────────────────────────────────────

export class ElevenLabsProvider implements ITTSServiceProvider {
  async synthesize(
    text: string,
    voiceId: string = DEFAULT_ELEVENLABS_VOICE_ID,
    speed: number = 1.0,
    options?: { modelId?: string; voiceSettings?: ElevenLabsVoiceSettings; signal?: AbortSignal }
  ): Promise<ProviderSynthesisOutput> {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is not configured.");
    }

    const modelId = options?.modelId || process.env.ELEVENLABS_DEFAULT_MODEL || DEFAULT_ELEVENLABS_MODEL_ID;

    const voiceSettings = {
      stability: options?.voiceSettings?.stability ?? 0.5,
      similarity_boost: options?.voiceSettings?.similarity_boost ?? 0.75,
      style: options?.voiceSettings?.style ?? 0.0,
      use_speaker_boost: options?.voiceSettings?.use_speaker_boost ?? true,
      speed: speed,
    };

    const endpoint = `${ELEVENLABS_API_CONFIG.BASE_URL}/text-to-speech/${encodeURIComponent(
      voiceId
    )}/with-timestamps?output_format=mp3_44100_128`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`ElevenLabs synthesis failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.audio_base64 || !data.alignment) {
      throw new Error("ElevenLabs returned invalid response missing audio_base64 or alignment.");
    }

    const audioBuffer = Buffer.from(data.audio_base64, "base64");

    // Calculate duration from character alignment in seconds
    const alignment = data.alignment as ElevenLabsAlignment;
    let durationMs = 0;
    if (alignment.character_end_times_seconds && alignment.character_end_times_seconds.length > 0) {
      const maxSec = Math.max(...alignment.character_end_times_seconds);
      durationMs = Math.round(maxSec * 1000);
    }

    // Convert character alignment into canonical Oculus LipSyncData
    const lipSyncData = await ElevenLabsAlignmentToVisemeAdapter.convert(alignment, durationMs);

    return {
      audioBuffer,
      audioExt: "mp3",
      durationMs,
      lipSyncData,
      provider: "elevenlabs",
      modelId,
      voiceId,
      alignmentSource: "elevenlabs",
      timingVersion: TIMING_ALGORITHM_VERSION,
    };
  }
}

// ─────────────────────────────────────────────
// 3. Central TTSManager Gateway
// ─────────────────────────────────────────────

export const PROVIDER_BASELINE_SPEED = DEFAULT_CALIBRATED_SPEED;

/**
 * Calculates effective TTS synthesis speed from user pacing preference.
 * Uses provider baseline speed (e.g. elevenlabs 0.90) as default starting preset,
 * and clamps user-selected speeds within supported provider limits.
 */
export function calculateEffectiveSpeed(
  provider: TTSProviderId,
  userPacing?: number | null
): number {
  const speed =
    typeof userPacing === "number" && userPacing > 0
      ? userPacing
      : (PROVIDER_BASELINE_SPEED[provider] ?? DEFAULT_SPEECH_SPEED);

  if (provider === "elevenlabs") {
    // Clamp to ElevenLabs supported range [0.70, 1.20]
    return Math.min(
      SPEECH_SPEED_LIMITS.MAX,
      Math.max(SPEECH_SPEED_LIMITS.MIN, Number(speed.toFixed(2)))
    );
  }
  return Number(speed.toFixed(2));
}

export class TTSManager {
  private headTTS: HeadTTSProvider;
  private elevenLabs: ElevenLabsProvider;

  constructor() {
    this.headTTS = new HeadTTSProvider();
    this.elevenLabs = new ElevenLabsProvider();
  }

  async synthesize(options: SynthesisOptions): Promise<SpeechResult> {
    const rawText = options.text?.trim();
    if (!rawText) {
      throw new Error("Text parameter is required for TTS synthesis.");
    }

    // Step 1: Preprocess and normalize text
    const normalizedText = SpeechPreprocessor.process(rawText);
    const provider: TTSProviderId = options.provider || DEFAULT_TTS_PROVIDER;
    const userPacing = typeof options.speed === "number" && options.speed > 0 ? options.speed : undefined;
    const speed = calculateEffectiveSpeed(provider, userPacing);
    const voiceId = options.voice || (provider === "elevenlabs" ? ELEVENLABS_FALLBACK_VOICE_ID : DEFAULT_FEMALE_VOICE_ID);
    const modelId =
      options.modelId || (provider === "elevenlabs" ? DEFAULT_ELEVENLABS_MODEL_ID : DEFAULT_HEADTTS_MODEL_ID);
    const requestId = options.requestId || crypto.randomUUID();

    // Step 2: Compute versioned, immutable cache key
    const cacheKey = generateTTSCacheKey({
      provider,
      modelId,
      voiceId,
      speed,
      voiceSettings: options.voiceSettings as Record<string, unknown>,
      normalizedText,
      speechPreprocessorVersion: SPEECH_PREPROCESSOR_VERSION,
      timingAlgorithmVersion: TIMING_ALGORITHM_VERSION,
      visemeMappingVersion: VISEME_MAPPING_VERSION,
    });

    const generatedDir = path.join(process.cwd(), "public", "generated", "audio");
    await fs.mkdir(generatedDir, { recursive: true });

    // Step 3: Check local file storage (Hard rule: Never re-synthesize existing hashes)
    const possibleExts: ("mp3" | "wav")[] = provider === "elevenlabs" ? ["mp3", "wav"] : ["wav", "mp3"];

    for (const ext of possibleExts) {
      const audioPath = path.join(generatedDir, `${cacheKey}.${ext}`);
      const metaPath = path.join(generatedDir, `${cacheKey}.json`);

      try {
        const [audioStat, metaRaw] = await Promise.all([fs.stat(audioPath), fs.readFile(metaPath, "utf-8")]);
        if (audioStat.isFile() && metaRaw) {
          const meta = JSON.parse(metaRaw);
          const relativeUrl = `/api/media/audio/${cacheKey}.${ext}`;
          return {
            requestId,
            cacheKey,
            provider: meta.provider || provider,
            modelId: meta.modelId || modelId,
            voiceId: meta.voiceId || voiceId,
            text: rawText,
            audioUrl: relativeUrl,
            audioPath: relativeUrl,
            durationMs: meta.durationMs || 0,
            lipSyncData: meta.lipSyncData,
            alignmentSource: meta.alignmentSource || (meta.provider === "elevenlabs" ? "elevenlabs" : "headtts"),
            timingVersion: meta.timingVersion || 1,
            cached: true,
          };
        }
      } catch {
        // Cache miss for this ext
      }
    }

    // Step 4: Execute Synthesis with Pre-Broadcast Fallback
    let output: ProviderSynthesisOutput;

    if (provider === "elevenlabs") {
      try {
        output = await this.elevenLabs.synthesize(normalizedText, voiceId, speed, {
          modelId,
          voiceSettings: options.voiceSettings,
          signal: options.signal,
        });
      } catch (elevenErr) {
        console.warn(
          "⚠️ [TTSManager] ElevenLabs synthesis failed. Executing pre-broadcast fallback to HeadTTS:",
          elevenErr instanceof Error ? elevenErr.message : elevenErr
        );
        // Pre-broadcast fallback: seamlessly invoke HeadTTS with matching gender voice
        const isLikelyMale = voiceId.startsWith("am_") || ["brian", "adam", "george", "liam", "eric", "daniel", "callum", "charlie"].some(name => voiceId.toLowerCase().includes(name));
        const fallbackVoice = isLikelyMale ? "am_fenrir" : "af_bella";
        output = await this.headTTS.synthesize(normalizedText, fallbackVoice, speed, {
          signal: options.signal,
        });
      }
    } else {
      output = await this.headTTS.synthesize(normalizedText, voiceId, speed, {
        signal: options.signal,
      });
    }

    // Step 5: Persist immutable audio & metadata files
    const audioFileName = `${cacheKey}.${output.audioExt}`;
    const metaFileName = `${cacheKey}.json`;
    const targetAudioPath = path.join(generatedDir, audioFileName);
    const targetMetaPath = path.join(generatedDir, metaFileName);

    // Hard rule: Never overwrite an existing file at an existing hash
    try {
      await fs.stat(targetAudioPath);
    } catch {
      await fs.writeFile(targetAudioPath, output.audioBuffer);
    }

    const metadataPayload = {
      requestId,
      cacheKey,
      provider: output.provider,
      modelId: output.modelId,
      voiceId: output.voiceId,
      durationMs: output.durationMs,
      lipSyncData: output.lipSyncData,
      alignmentSource: output.alignmentSource,
      timingVersion: output.timingVersion,
      createdAt: new Date().toISOString(),
    };

    try {
      await fs.stat(targetMetaPath);
    } catch {
      await fs.writeFile(targetMetaPath, JSON.stringify(metadataPayload, null, 2));
    }

    const relativeAudioUrl = `/api/media/audio/${audioFileName}`;

    return {
      requestId,
      cacheKey,
      provider: output.provider,
      modelId: output.modelId,
      voiceId: output.voiceId,
      text: rawText,
      audioUrl: relativeAudioUrl,
      audioPath: relativeAudioUrl,
      durationMs: output.durationMs,
      lipSyncData: output.lipSyncData,
      alignmentSource: output.alignmentSource,
      timingVersion: output.timingVersion,
      cached: false,
    };
  }
}

// Global singleton instance
export const ttsManager = new TTSManager();
