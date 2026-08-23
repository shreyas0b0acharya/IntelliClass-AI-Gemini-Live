import type { SpeechItem, TTSFetchOptions } from "../types/speech";

export async function fetchSpeechTTS({
  text,
  voice = "af_bella",
  requestId,
  signal,
}: TTSFetchOptions): Promise<SpeechItem> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
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
