import type { SpeechItem, TTSFetchOptions } from "../types/speech";
import {
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_SPEECH_SPEED,
} from "@/config";

export async function fetchSpeechTTS({
  text,
  voice = DEFAULT_FEMALE_VOICE_ID,
  provider = DEFAULT_TTS_PROVIDER,
  modelId,
  speed = DEFAULT_SPEECH_SPEED,
  voiceSettings,
  requestId,
  signal,
}: TTSFetchOptions): Promise<SpeechItem> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      provider,
      modelId,
      speed,
      voiceSettings,
      requestId,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMsg = `TTS HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errJson.details || errorMsg;
    } catch {
      const rawText = await response.text();
      errorMsg = rawText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as SpeechItem;

  if (!data.audioPath || !data.lipSyncData) {
    throw new Error("TTS response missing required audio or lip-sync payload.");
  }

  return data;
}
