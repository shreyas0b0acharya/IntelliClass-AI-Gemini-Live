import { NextResponse, type NextRequest } from "next/server";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Verify caller owns the session
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, created_by, status, courses(created_by)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner =
      session.created_by === user.id ||
      (session.courses && (session.courses as { created_by?: string }).created_by === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: Only the conductor can grant or revoke the microphone floor." },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body = (await request.json()) as {
      studentIdentity?: string;
      action?: "grant" | "revoke";
    };

    const { studentIdentity, action = "grant" } = body;

    if (!studentIdentity) {
      return NextResponse.json(
        { error: "Missing required parameter: studentIdentity" },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit server credentials are not configured" },
        { status: 500 }
      );
    }

    const httpUrl = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const roomName = `classroom:${sessionId}`;

    if (action === "grant") {
      await roomService.updateParticipant(roomName, studentIdentity, {
        permission: {
          canSubscribe: true,
          canPublish: true,
          canPublishData: true,
          canPublishSources: [TrackSource.MICROPHONE],
        },
      });
    } else {
      await roomService.updateParticipant(roomName, studentIdentity, {
        permission: {
          canSubscribe: true,
          canPublish: false,
          canPublishData: true,
          canPublishSources: [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      roomName,
      studentIdentity,
      action,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/grant-floor error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
