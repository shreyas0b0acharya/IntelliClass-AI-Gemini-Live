import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

interface TTSRequest {
  requestId?: string;
  text: string;
  voice?: string;
  speed?: number;
}

interface HeadTTSResponse {
  audio: string;
  audioEncoding: string;
  visemes: string[];
  vtimes: number[];
  vdurations: number[];
  phonemes?: string[];
  words?: string[];
  wtimes?: number[];
  wdurations?: number[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TTSRequest;
    const text = body.text?.trim();
    const voice = body.voice || "af_bella";
    const speed = typeof body.speed === "number" && body.speed > 0 ? body.speed : 1;
    const requestId = body.requestId || crypto.randomUUID();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // Deterministic cache key for audio & visemes including voice & speed
    const cacheKey = crypto
      .createHash("sha256")
      .update(`${text}_${voice}_${speed.toFixed(2)}`)
      .digest("hex")
      .slice(0, 24);

    const generatedDir = path.join(process.cwd(), "public", "generated", "audio");
    await fs.mkdir(generatedDir, { recursive: true });

    const audioFileName = `${cacheKey}.wav`;
    const metadataFileName = `${cacheKey}.json`;
    const audioFilePath = path.join(generatedDir, audioFileName);
    const metadataFilePath = path.join(generatedDir, metadataFileName);

    // 1. Check local cache
    try {
      const [audioStat, metadataContent] = await Promise.all([
        fs.stat(audioFilePath),
        fs.readFile(metadataFilePath, "utf-8"),
      ]);

      if (audioStat.isFile() && metadataContent) {
        const cachedMeta = JSON.parse(metadataContent);
        return NextResponse.json({
          requestId,
          cacheKey,
          audioPath: `/api/media/audio/${audioFileName}`,
          audioUrl: `/api/media/audio/${audioFileName}`,
          durationMs: cachedMeta.durationMs || 0,
          lipSyncData: cachedMeta.lipSyncData,
          text,
          cached: true,
        });
      }
    } catch {
      // Cache miss — proceed to synthesis
    }

    // 2. Call HeadTTS engine
    const headTTSUrl = process.env.HEADTTS_URL ?? "http://127.0.0.1:8882/v1/synthesize";

    const response = await fetch(headTTSUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: text,
        voice,
        language: "en-us",
        speed,
        audioEncoding: "wav",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HeadTTS error:", errorText);
      return NextResponse.json(
        { error: "HeadTTS generation failed.", details: errorText },
        { status: 502 }
      );
    }

    const data = (await response.json()) as HeadTTSResponse;

    if (
      !data.audio ||
      !Array.isArray(data.visemes) ||
      !Array.isArray(data.vtimes) ||
      !Array.isArray(data.vdurations)
    ) {
      return NextResponse.json(
        { error: "HeadTTS returned invalid synthesis data." },
        { status: 502 }
      );
    }

    // 3. Save WAV audio buffer
    const audioBuffer = Buffer.from(data.audio, "base64");
    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: "HeadTTS returned empty audio." }, { status: 502 });
    }

    await fs.writeFile(audioFilePath, audioBuffer);

    // Calculate approximate duration in ms from visemes
    let durationMs = 0;
    if (data.vtimes.length > 0 && data.vdurations.length > 0) {
      const lastIdx = data.vtimes.length - 1;
      durationMs = Math.round(data.vtimes[lastIdx] + data.vdurations[lastIdx]);
    }

    const lipSyncData = {
      visemes: data.visemes,
      vtimes: data.vtimes,
      vdurations: data.vdurations,
      phonemes: data.phonemes,
      words: data.words,
      wtimes: data.wtimes,
      wdurations: data.wdurations,
    };

    // Save metadata cache
    await fs.writeFile(
      metadataFilePath,
      JSON.stringify(
        {
          requestId,
          cacheKey,
          durationMs,
          lipSyncData,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

    return NextResponse.json({
      requestId,
      cacheKey,
      audioPath: `/api/media/audio/${audioFileName}`,
      audioUrl: `/api/media/audio/${audioFileName}`,
      durationMs,
      lipSyncData,
      text,
      cached: false,
    });
  } catch (err: unknown) {
    console.error("API /api/tts error:", err);
    const msg = err instanceof Error ? err.message : "Internal TTS error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}