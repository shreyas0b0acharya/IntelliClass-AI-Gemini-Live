import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { studentAIQuestionAnswering } from "@/ai/flows/answer-question";

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

    const body = await request.json().catch(() => ({}));
    const {
      question,
      courseId,
      studentName,
      lecturerName,
      lastSpokenSentence,
      sessionTopic,
      currentIndex,
    } = body;

    if (!question || !courseId) {
      return NextResponse.json(
        { error: "Question and courseId are required." },
        { status: 400 }
      );
    }

    // Call Genkit Gemini flow
    const response = await studentAIQuestionAnswering({
      question,
      courseId,
      studentName: studentName || "Student",
      lecturerName: lecturerName || "Professor",
      lastSpokenSentence,
      sessionTopic,
      currentIndex,
    });

    return NextResponse.json({
      answer: response.answer,
      mode: response.mode,
    });
  } catch (error: unknown) {
    console.error("API /classroom/ask error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to process question." },
      { status: 500 }
    );
  }
}
