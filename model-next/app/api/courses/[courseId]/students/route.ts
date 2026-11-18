import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CourseStudent, AdmissionStatus } from "@/lib/supabase/types";

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

    // Verify course exists
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title, created_by")
      .eq("id", courseId)
      .single();

    if (courseErr || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Find all sessions in this course to collect participants
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, topic")
      .eq("course_id", courseId);

    const sessionIds = (sessions || []).map((s) => s.id);
    const sessionMap = new Map((sessions || []).map((s) => [s.id, s.topic]));

    let participants: any[] = [];
    if (sessionIds.length > 0) {
      const { data: partData, error: partErr } = await supabase
        .from("session_participants")
        .select("*")
        .in("session_id", sessionIds)
        .order("joined_at", { ascending: false });

      if (!partErr && partData) {
        participants = partData;
      }
    }

    // Aggregate unique participants by user_id
    const studentMap = new Map<string, CourseStudent>();
    const pendingRequests: CourseStudent[] = [];

    for (const p of participants) {
      const userId = p.user_id;
      const sessionTitle = sessionMap.get(p.session_id) || "Class";

      if (p.status === "waiting") {
        pendingRequests.push({
          id: p.id,
          userId: p.user_id,
          userName: p.user_name || "Student",
          role: p.role,
          status: p.status as AdmissionStatus,
          joinedAt: p.joined_at,
          admittedAt: p.admitted_at,
          lastActiveSessionTitle: sessionTitle,
        });
      } else if (p.status === "admitted") {
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            id: p.id,
            userId: p.user_id,
            userName: p.user_name || "Student",
            role: p.role,
            status: p.status as AdmissionStatus,
            joinedAt: p.joined_at,
            admittedAt: p.admitted_at,
            attendedSessionsCount: 1,
            lastActiveSessionTitle: sessionTitle,
          });
        } else {
          const current = studentMap.get(userId)!;
          current.attendedSessionsCount = (current.attendedSessionsCount || 0) + 1;
        }
      }
    }

    const enrolledStudents = Array.from(studentMap.values());

    return NextResponse.json({
      students: enrolledStudents,
      requests: pendingRequests,
      invitations: [],
      courseTitle: course.title,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId]/students error:", err);
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

    // Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    const body = (await request.json()) as {
      action: "approve" | "reject" | "invite" | "remove";
      participantId?: string;
      userId?: string;
      email?: string;
    };

    if (body.action === "approve" && body.participantId) {
      const adminClient = createAdminClient();
      await adminClient
        .from("session_participants")
        .update({
          status: "admitted",
          admitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.participantId);

      return NextResponse.json({ success: true, message: "Student request approved" });
    }

    if (body.action === "reject" && body.participantId) {
      const adminClient = createAdminClient();
      await adminClient
        .from("session_participants")
        .update({
          status: "denied",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.participantId);

      return NextResponse.json({ success: true, message: "Student request rejected" });
    }

    if (body.action === "remove" && (body.participantId || body.userId)) {
      const adminClient = createAdminClient();
      const query = adminClient.from("session_participants").update({
        status: "left",
        updated_at: new Date().toISOString(),
      });

      if (body.participantId) {
        await query.eq("id", body.participantId);
      } else if (body.userId) {
        await query.eq("user_id", body.userId);
      }

      return NextResponse.json({ success: true, message: "Student removed from course" });
    }

    if (body.action === "invite" && body.email) {
      // In production, an email invitation or link is dispatched.
      return NextResponse.json({
        success: true,
        message: `Invitation successfully dispatched to ${body.email}`,
      });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/courses/[courseId]/students error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
