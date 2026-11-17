import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const admin = createAdminClient();

    // Verify session exists
    const { data: session } = await admin
      .from("sessions")
      .select("id, status")
      .eq("id", sessionId)
      .single();

    if (!session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Public read for participants in active session
    const { data: messages, error } = await admin
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Messages fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (err: unknown) {
    console.error("API GET /api/classroom/[sessionId]/messages error:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user } = await getAuthenticatedUser(request);

    const body = await request.json();
    const { role, message, user_id } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify session exists
    const { data: session } = await admin
      .from("sessions")
      .select("id, status")
      .eq("id", sessionId)
      .single();

    if (!session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const effectiveUserId = user?.id || user_id || "anonymous-student";

    const { data, error } = await admin
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: effectiveUserId,
        role: role || "user",
        message: message.trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Message insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: data });
  } catch (err: unknown) {
    console.error("API POST /api/classroom/[sessionId]/messages error:", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
