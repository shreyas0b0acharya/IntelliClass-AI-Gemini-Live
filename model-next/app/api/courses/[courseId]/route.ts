import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Isolate course query to creator
    const { data: course, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (error || !course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
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

    // Verify course ownership first
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    // Delete linked document chunks, files, sessions, and course
    await supabase.from("document_chunks").delete().eq("course_id", courseId);
    await supabase.from("course_files").delete().eq("course_id", courseId);
    await supabase.from("sessions").delete().eq("course_id", courseId);

    const { error: courseDeleteError } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId)
      .eq("created_by", user.id);

    if (courseDeleteError) {
      return NextResponse.json({ error: courseDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API DELETE /api/courses/[courseId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
