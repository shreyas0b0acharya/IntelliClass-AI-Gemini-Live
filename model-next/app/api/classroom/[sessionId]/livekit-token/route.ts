import { NextResponse, type NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const admin = createAdminClient();

    // 1. Fetch session to verify it exists and is active
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, created_by, status, courses(created_by)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 2. Identify caller
    const { user } = await getAuthenticatedUser(request);
    let body: { participantId?: string; participantName?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty on simple POST
    }

    const isConductor = Boolean(
      user &&
        (user.id === session.created_by ||
          (session.courses && (session.courses as { created_by?: string }).created_by === user.id))
    );

    const identity = user
      ? user.id
      : body.participantId || `student-${Math.random().toString(36).substring(2, 9)}`;

    const name = isConductor
      ? "AI Professor Conductor"
      : body.participantName || (user?.email ? user.email.split("@")[0] : "Student");

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit server credentials are not properly configured" },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: "4h",
      metadata: JSON.stringify({
        isConductor,
        sessionId,
        role: isConductor ? "conductor" : "student",
      }),
    });

    at.addGrant({
      roomJoin: true,
      room: `classroom:${sessionId}`,
      canPublish: isConductor,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      url: livekitUrl,
      room: `classroom:${sessionId}`,
      identity,
      name,
      isConductor,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/livekit-token error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
