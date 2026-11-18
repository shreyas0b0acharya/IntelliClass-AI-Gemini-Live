import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRoadmapFlow } from "@/ai/flows/generate-roadmap";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify course exists and user is owner
    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, title, created_by")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.created_by !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this course space." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      lectureTopic?: string;
      targetDurationMinutes?: number;
      sources?: Array<{ fileName: string; startPage?: number; endPage?: number }>;
      customPrompt?: string;
    };

    const topic = body.lectureTopic || course.title || "Curriculum Roadmap";

    // Execute Roadmap Generation Flow directly grounded in course documents
    const roadmap = await generateRoadmapFlow({
      courseId,
      sessionId: "",
      lectureTopic: topic,
      targetDurationMinutes: body.targetDurationMinutes || 45,
      sources: body.sources,
      customPrompt: body.customPrompt,
    });

    return NextResponse.json({
      success: true,
      roadmap,
    });
  } catch (err: unknown) {
    console.error("API POST /api/courses/[courseId]/roadmaps/generate error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
