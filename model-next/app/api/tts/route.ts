import { NextRequest, NextResponse } from "next/server";
import { ttsManager } from "@/lib/tts/ttsProviders";
import type { TTSProviderId, ElevenLabsVoiceSettings } from "@/features/classroom/types/speech";

export const runtime = "nodejs";

interface TTSRequestBody {
  requestId?: string;
  text: string;
  voice?: string;
  provider?: TTSProviderId;
  modelId?: string;
  speed?: number;
  voiceSettings?: ElevenLabsVoiceSettings;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TTSRequestBody;
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const result = await ttsManager.synthesize({
      text,
      voice: body.voice,
      provider: body.provider,
      modelId: body.modelId,
      speed: body.speed,
      voiceSettings: body.voiceSettings,
      requestId: body.requestId,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("API /api/tts error:", err);
    const msg = err instanceof Error ? err.message : "Internal TTS error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}