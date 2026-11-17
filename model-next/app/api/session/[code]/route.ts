import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 });
    }

    const cleanCode = code.trim().toLowerCase();
    const admin = createAdminClient();

    // 1. Check if code is a session UUID or meeting_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);

    let sessionQuery = admin
      .from("sessions")
      .select("*, courses(*)");

    if (isUuid) {
      sessionQuery = sessionQuery.eq("id", cleanCode);
    } else {
      sessionQuery = sessionQuery.ilike("meeting_code", cleanCode);
    }

    const { data: session } = await sessionQuery.maybeSingle();

    if (!session || session.status === "deleted") {
      return NextResponse.json(
        { error: "No lecture session found with this code. Please verify the session code." },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/session/[code] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
