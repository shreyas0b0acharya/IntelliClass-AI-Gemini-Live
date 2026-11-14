import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { studentAIQuestionAnswering } from "@/ai/flows/answer-question";
import { ttsManager } from "@/lib/tts/ttsProviders";
import type { TTSProviderId } from "@/features/classroom/types/speech";
import type { HeadTTSData } from "@/features/avatar";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId: _sessionId } = await params;
    const { user, supabase: _supabase } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      courseId,
      studentName,
      lecturerName,
      lastSpokenSentence,
      sessionTopic,
      currentIndex,
      voice,
      provider,
      speed,
    } = body;

    if (!question || !courseId) {
      return NextResponse.json(
        { error: "Question and courseId are required." },
        { status: 400 }
      );
    }

    // Call Genkit flow
    const response = await studentAIQuestionAnswering({
      question,
      courseId,
      studentName: studentName || "Student",
      lecturerName: lecturerName || "Professor",
      lastSpokenSentence,
      sessionTopic,
      currentIndex,
    });

    const answer = response.answer;
    let audioUrl: string | undefined = undefined;
    let lipSyncData: HeadTTSData | undefined = undefined;
    let durationMs: number | undefined = undefined;

    // Fast unified server-side synthesis: avoids extra client roundtrip latency
    if (answer && voice) {
      try {
        const speechRes = await ttsManager.synthesize({
          text: answer,
          voice,
          provider: (provider as TTSProviderId) || undefined,
          speed: typeof speed === "number" ? speed : undefined,
        });
        audioUrl = speechRes.audioPath;
        lipSyncData = speechRes.lipSyncData;
        durationMs = speechRes.durationMs;
      } catch (ttsErr) {
        console.warn("⚠️ [Classroom Ask API] Server-side TTS fallback:", ttsErr);
      }
    }

    return NextResponse.json({
      answer,
      mode: response.mode,
      audioUrl,
      lipSyncData,
      durationMs,
    });
  } catch (error: unknown) {
    console.error("API /classroom/ask error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to process question." },
      { status: 500 }
    );
  }
}
