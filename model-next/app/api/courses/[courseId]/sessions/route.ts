import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("course_id", courseId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Course sessions fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out any deleted sessions and ensure fallback defaults
    const normalizedSessions = (sessions || [])
      .filter((s) => s.status !== "deleted")
      .map((s) => ({
        ...s,
        voice_id: s.voice_id || "am_fenrir",
        meeting_code: s.meeting_code || s.id?.slice(0, 8),
      }));

    return NextResponse.json({ sessions: normalizedSessions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/courses/[courseId]/sessions error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Generates a unique, cryptographically random system meeting code
 * Format: cls-xxxx-xxxx (e.g. cls-8f3a-9c2e)
 */
function generateUniqueMeetingCode(): string {
  const p1 = crypto.randomBytes(2).toString("hex");
  const p2 = crypto.randomBytes(2).toString("hex");
  return `cls-${p1}-${p2}`;
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

    // 1. Verify lecturer role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "lecturer") {
      return NextResponse.json(
        { error: "Forbidden: Only faculty/lecturers can create lecture sessions." },
        { status: 403 }
      );
    }

    // 2. Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const voice_id = typeof body.voice_id === "string" ? body.voice_id : "am_fenrir";
    
    // Always auto-generate a unique system meeting code
    const meeting_code = generateUniqueMeetingCode();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // Dynamic insert payload with resilient retry for un-migrated columns
    const insertPayload: Record<string, unknown> = {
      course_id: courseId,
      topic,
      voice_id: voice_id || "am_fenrir",
      status: "created",
      created_by: user.id,
      meeting_code,
    };

    let session: Record<string, unknown> | null = null;
    let insertError: { message: string } | null = null;

    // Retry loop: if PostgREST reports a missing column, strip it and retry
    while (Object.keys(insertPayload).length > 0) {
      const res = await supabase
        .from("sessions")
        .insert(insertPayload)
        .select()
        .single();

      if (!res.error && res.data) {
        session = res.data as Record<string, unknown>;
        insertError = null;
        break;
      }

      insertError = res.error;
      const errMsg = res.error?.message || "";
      const match = errMsg.match(/Could not find the '([^']+)' column/);
      if (match && match[1] && match[1] in insertPayload) {
        console.warn(
          `[Supabase] sessions table missing column '${match[1]}', omitting and retrying insert`
        );
        delete insertPayload[match[1]];
      } else {
        // Unrecoverable database error
        break;
      }
    }

    if (insertError || !session) {
      console.error("Session create error:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to insert session" },
        { status: 500 }
      );
    }

    // Ensure client always receives non-null voice_id and meeting_code
    const normalizedSession = {
      ...session,
      voice_id: session.voice_id || voice_id || "am_fenrir",
      meeting_code: session.meeting_code || meeting_code,
    };

    return NextResponse.json({ session: normalizedSession });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/courses/[courseId]/sessions error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
