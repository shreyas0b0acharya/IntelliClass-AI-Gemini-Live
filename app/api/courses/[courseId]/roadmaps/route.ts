import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CourseRoadmapItem } from "@/lib/supabase/types";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify course
    const { data: course } = await supabase
      .from("courses")
      .select("id, title")
      .eq("id", courseId)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Fetch sessions in this course that have a roadmap
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id, topic, status, roadmap, created_at")
      .eq("course_id", courseId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const roadmaps: CourseRoadmapItem[] = [];
    const seenTopics = new Set<string>();

    for (const s of sessions || []) {
      const rm = s.roadmap;
      if (rm && Array.isArray(rm.topics) && rm.topics.length > 0) {
        const title = rm.lectureTopic || s.topic;
        if (!seenTopics.has(title)) {
          seenTopics.add(title);
          const topicsCount = rm.topics.length;
          const objectivesCount = rm.topics.reduce(
            (acc: number, t: any) => acc + (t.learningObjectives?.length || 0),
            0
          );
          const estimatedMinutes =
            rm.totalEstimatedMinutes ||
            rm.topics.reduce((acc: number, t: any) => acc + (t.estimatedDurationMinutes || 10), 0);

          roadmaps.push({
            id: s.id,
            title,
            sessionId: s.id,
            status: s.status === "draft" ? "draft" : "published",
            topicsCount,
            objectivesCount,
            estimatedMinutes,
            roadmap: rm,
            createdAt: s.created_at,
          });
        }
      }
    }

    return NextResponse.json({ roadmaps });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId]/roadmaps error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      title: string;
      roadmap: any;
      publish?: boolean;
    };

    if (!body.title || !body.roadmap) {
      return NextResponse.json({ error: "Title and roadmap structure are required" }, { status: 400 });
    }

    const meeting_code = `cls-${crypto.randomBytes(2).toString("hex")}-${crypto.randomBytes(2).toString("hex")}`;
    const status = body.publish ? "created" : "draft";

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        course_id: courseId,
        topic: body.title.trim(),
        roadmap: body.roadmap,
        status,
        meeting_code,
        created_by: user.id,
        live_session_stats: { is_roadmap_template: true },
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      roadmapItem: {
        id: session.id,
        title: body.title.trim(),
        sessionId: session.id,
        status: status === "draft" ? "draft" : "published",
        topicsCount: body.roadmap.topics?.length || 0,
        objectivesCount: (body.roadmap.topics || []).reduce(
          (acc: number, t: any) => acc + (t.learningObjectives?.length || 0),
          0
        ),
        estimatedMinutes: body.roadmap.totalEstimatedMinutes || 30,
        roadmap: body.roadmap,
        createdAt: session.created_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/courses/[courseId]/roadmaps error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
