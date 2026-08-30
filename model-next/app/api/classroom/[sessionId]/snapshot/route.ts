import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionParticipantRecord, AdmissionStatus } from "@/lib/supabase/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    // 1. Authenticate caller
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Fetch session
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isLecturer = session.created_by === user.id;

    // 3. Fetch participants from PostgreSQL
    let participants: SessionParticipantRecord[] = [];
    const { data: partData, error: partError } = await admin
      .from("session_participants")
      .select("*")
      .eq("session_id", sessionId);

    if (!partError && Array.isArray(partData)) {
      participants = partData as SessionParticipantRecord[];
    }

    const myParticipant = participants.find((p) => p.user_id === user.id);
    let myStatus: AdmissionStatus = isLecturer ? "admitted" : (myParticipant?.status || "waiting");

    // 4. Filter participants roster based on RLS / authorization policy
    // Lecturer sees all participants; admitted students see all admitted classmates; waiting students see self only
    let visibleParticipants: SessionParticipantRecord[] = [];

    if (isLecturer) {
      visibleParticipants = participants;
    } else if (myStatus === "admitted") {
      visibleParticipants = participants.filter(
        (p) => p.status === "admitted" || p.user_id === user.id
      );
    } else if (myParticipant) {
      visibleParticipants = [myParticipant];
    }

    const stateVersion = Number(session.state_version) || 0;

    return NextResponse.json({
      session: {
        ...session,
        voice_id: session.voice_id || "am_fenrir",
        meeting_code: session.meeting_code || session.id?.slice(0, 8),
        state_version: stateVersion,
      },
      myStatus,
      myRole: isLecturer ? "lecturer" : "student",
      stateVersion,
      participants: visibleParticipants.map((p) => ({
        userId: p.user_id,
        name: p.user_name,
        role: p.role,
        status: p.status,
        joinedAt: p.joined_at,
        admittedAt: p.admitted_at,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/classroom/[sessionId]/snapshot error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
