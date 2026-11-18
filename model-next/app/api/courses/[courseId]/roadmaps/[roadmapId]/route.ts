import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CourseRoadmapItem } from "@/lib/supabase/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; roadmapId: string }> }
) {
  try {
    const { courseId, roadmapId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, topic, status, roadmap, created_at, created_by")
      .eq("id", roadmapId)
      .eq("course_id", courseId)
      .neq("status", "deleted")
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 });
    }

    const rm = session.roadmap;
    const topicsCount = rm?.topics?.length || 0;
    const objectivesCount = (rm?.topics || []).reduce(
      (acc: number, t: any) => acc + (t.learningObjectives?.length || 0),
      0
    );
    const estimatedMinutes =
      rm?.totalEstimatedMinutes ||
      (rm?.topics || []).reduce((acc: number, t: any) => acc + (t.estimatedDurationMinutes || 10), 0);

    const roadmapItem: CourseRoadmapItem = {
      id: session.id,
      title: session.topic,
      sessionId: session.id,
      status: session.status === "draft" ? "draft" : "published",
      topicsCount,
      objectivesCount,
      estimatedMinutes,
      roadmap: rm,
      createdAt: session.created_at,
    };

    return NextResponse.json({ roadmapItem });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId]/roadmaps/[roadmapId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; roadmapId: string }> }
) {
  try {
    const { courseId, roadmapId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify course ownership or lecturer role
    const { data: course } = await supabase
      .from("courses")
      .select("id, created_by")
      .eq("id", courseId)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      title?: string;
      roadmap?: any;
      publish?: boolean;
      status?: "published" | "draft";
    };

    const updatePayload: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      updatePayload.topic = body.title.trim();
    }

    if (body.roadmap) {
      updatePayload.roadmap = body.roadmap;
    }

    if (typeof body.publish === "boolean") {
      updatePayload.status = body.publish ? "created" : "draft";
    } else if (body.status) {
      updatePayload.status = body.status === "published" ? "created" : "draft";
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .update(updatePayload)
      .eq("id", roadmapId)
      .eq("course_id", courseId)
      .neq("status", "deleted")
      .select()
      .single();

    if (error || !session) {
      return NextResponse.json({ error: error?.message || "Failed to update roadmap" }, { status: 500 });
    }

    const rm = session.roadmap;
    const topicsCount = rm?.topics?.length || 0;
    const objectivesCount = (rm?.topics || []).reduce(
      (acc: number, t: any) => acc + (t.learningObjectives?.length || 0),
      0
    );
    const estimatedMinutes =
      rm?.totalEstimatedMinutes ||
      (rm?.topics || []).reduce((acc: number, t: any) => acc + (t.estimatedDurationMinutes || 10), 0);

    const roadmapItem: CourseRoadmapItem = {
      id: session.id,
      title: session.topic,
      sessionId: session.id,
      status: session.status === "draft" ? "draft" : "published",
      topicsCount,
      objectivesCount,
      estimatedMinutes,
      roadmap: rm,
      createdAt: session.created_at,
    };

    return NextResponse.json({ success: true, roadmapItem });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API PATCH /api/courses/[courseId]/roadmaps/[roadmapId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; roadmapId: string }> }
) {
  try {
    const { courseId, roadmapId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify course exists
    const { data: course } = await supabase
      .from("courses")
      .select("id, created_by")
      .eq("id", courseId)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Soft-delete the session backing this roadmap
    const { error: deleteError } = await supabase
      .from("sessions")
      .update({ status: "deleted" })
      .eq("id", roadmapId)
      .eq("course_id", courseId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API DELETE /api/courses/[courseId]/roadmaps/[roadmapId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
