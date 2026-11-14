import { NextRequest, NextResponse } from "next/server";
import type { VoiceOption, VoiceGender, TTSModelOption } from "@/features/classroom/types/speech";
import { HEADTTS_VOICE_OPTIONS, ELEVENLABS_VOICE_OPTIONS, TTS_MODELS } from "@/features/classroom/constants/voices";

export const runtime = "nodejs";

interface CachedVoicesData {
  voices: VoiceOption[];
  models: TTSModelOption[];
}

let cache: { data: CachedVoicesData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

interface ElevenLabsRawVoice {
  category?: string;
  is_owner?: boolean;
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, string | undefined> & {
    gender?: string;
    accent?: string;
    age?: string;
    description?: string;
    "use case"?: string;
    use_case?: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";
  const now = Date.now();

  // Return cached result if valid and not forcing refresh
  if (!forceRefresh && cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  let elevenLabsVoices: VoiceOption[] = [];

  if (apiKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const json = await response.json();
        const rawVoices = Array.isArray(json.voices) ? json.voices : [];

        // STRICT FILTER: Never show payment/library voices.
        // Free accounts cannot use library/professional community voices via the API (HTTP 402).
        // Only include official built-in premade voices or user-owned/cloned voices.
        const freeUsableVoices = rawVoices.filter((v: ElevenLabsRawVoice) => {
          if (v.category === "premade") return true;
          if (v.is_owner === true || v.category === "cloned") return true;
          return false;
        });

        elevenLabsVoices = freeUsableVoices.map((v: ElevenLabsRawVoice): VoiceOption => {
          const rawGender = v.labels?.gender?.toLowerCase()?.trim();
          const gender: VoiceGender =
            rawGender === "female" ? "female" : rawGender === "male" ? "male" : "unknown";

          return {
            id: v.voice_id,
            name: v.name,
            provider: "elevenlabs",
            gender,
            accent: v.labels?.accent,
            age: v.labels?.age,
            useCase: v.labels?.["use case"] || v.labels?.use_case,
            category: v.category,
            description: v.description || v.labels?.description,
          };
        });
      } else {
        console.warn(`[VoicesAPI] Failed to fetch ElevenLabs voices (${response.status}), using fallbacks.`);
      }
    } catch (err) {
      console.warn("[VoicesAPI] Error querying ElevenLabs voices API:", err);
    }
  }

  // Fallback if ElevenLabs fetch returned empty or failed
  if (elevenLabsVoices.length === 0) {
    elevenLabsVoices = ELEVENLABS_VOICE_OPTIONS;
  }

  // Merge HeadTTS system voices with ElevenLabs voices
  const allVoices: VoiceOption[] = [...HEADTTS_VOICE_OPTIONS, ...elevenLabsVoices];

  const payload: CachedVoicesData = {
    voices: allVoices,
    models: TTS_MODELS,
  };

  cache = {
    data: payload,
    timestamp: now,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
  });
}
