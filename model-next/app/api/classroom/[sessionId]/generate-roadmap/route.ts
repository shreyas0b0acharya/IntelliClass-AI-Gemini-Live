import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRoadmapFlow } from "@/ai/flows/generate-roadmap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Fetch session and verify ownership
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner =
      session.created_by === user.id ||
      (session.courses && (session.courses as { created_by?: string }).created_by === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this session." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      lectureTopic?: string;
      targetDurationMinutes?: number;
      sources?: Array<{ fileName: string; startPage?: number; endPage?: number }>;
      customPrompt?: string;
    };

    const topic = body.lectureTopic || session.topic || "Lecture Overview";

    // 2. Execute Roadmap Generation Flow
    const roadmap = await generateRoadmapFlow({
      courseId: session.course_id,
      sessionId: session.id,
      lectureTopic: topic,
      targetDurationMinutes: body.targetDurationMinutes || 30,
      sources: body.sources,
      customPrompt: body.customPrompt,
    });

    const initialTopicId = roadmap.topics[0]?.id || null;

    // 3. Persist generated roadmap and initial topic to database
    const { error: updateError } = await admin
      .from("sessions")
      .update({
        roadmap,
        current_topic_id: initialTopicId,
        topic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to persist roadmap to session:", updateError);
      return NextResponse.json({ error: "Failed to persist roadmap" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roadmap,
      currentTopicId: initialTopicId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/generate-roadmap error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
