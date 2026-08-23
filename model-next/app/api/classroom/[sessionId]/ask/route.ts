import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { studentAIQuestionAnswering } from "@/ai/flows/answer-question";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { question, courseId, studentName, lecturerName, lastSpokenSentence, sessionTopic, currentIndex } = body;

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

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("API /classroom/ask error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process question." },
      { status: 500 }
    );
  }
}
