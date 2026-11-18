import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import crypto from "crypto";

function generateUniqueMeetingCode(): string {
  const p1 = crypto.randomBytes(2).toString("hex");
  const p2 = crypto.randomBytes(2).toString("hex");
  return `cls-${p1}-${p2}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing source session
    const { data: sourceSession, error: fetchErr } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !sourceSession) {
      return NextResponse.json({ error: "Source session not found" }, { status: 404 });
    }

    // Verify user is session creator or course owner
    const isOwner =
      sourceSession.created_by === user.id ||
      sourceSession.courses?.created_by === user.id;

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meeting_code = generateUniqueMeetingCode();

    // Clone configuration ONLY - fresh notes, zero attendance, fresh session
    const insertPayload: Record<string, unknown> = {
      course_id: sourceSession.course_id,
      topic: `${sourceSession.topic} (Repeat)`,
      script: sourceSession.script || "",
      voice_id: sourceSession.voice_id,
      avatar_model: sourceSession.avatar_model,
      speech_speed: sourceSession.speech_speed,
      tts_provider: sourceSession.tts_provider,
      roadmap: sourceSession.roadmap || null,
      status: "created",
      current_sentence_index: 0,
      sequence: 0,
      meeting_code,
      created_by: user.id,
      live_session_stats: {},
    };

    const { data: newSession, error: insertErr } = await supabase
      .from("sessions")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr || !newSession) {
      console.error("Repeat session insert error:", insertErr);
      return NextResponse.json({ error: insertErr?.message || "Failed to clone session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: newSession,
      message: "Class session successfully cloned for repeat broadcast",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/repeat error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
