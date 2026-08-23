import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ error: "Session code is required" }, { status: 400 });
    }

    const cleanCode = code.trim().toLowerCase();
    const supabase = await createClient();

    // 1. Try resolving by meeting_code first
    let { data: session, error } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .ilike("meeting_code", cleanCode)
      .maybeSingle();

    // 2. If not found by meeting_code, check if code is a session UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
    if (!session && isUuid) {
      const res = await supabase
        .from("sessions")
        .select("*, courses(*)")
        .eq("id", cleanCode)
        .maybeSingle();
      if (res.data) {
        session = res.data;
        error = null;
      }
    }

    // 3. Fallback: match prefix or partial code
    if (!session && cleanCode.length >= 4) {
      const res = await supabase
        .from("sessions")
        .select("*, courses(*)")
        .or(`meeting_code.ilike.%${cleanCode}%,id.ilike.${cleanCode}%`)
        .limit(1)
        .maybeSingle();
      if (res.data) {
        session = res.data;
        error = null;
      }
    }

    // 4. Admin client fallback in case RLS blocked unauthenticated/student query
    if (!session) {
      try {
        const admin = createAdminClient();
        let res = await admin
          .from("sessions")
          .select("*, courses(*)")
          .ilike("meeting_code", cleanCode)
          .maybeSingle();

        if (!res.data && isUuid) {
          res = await admin
            .from("sessions")
            .select("*, courses(*)")
            .eq("id", cleanCode)
            .maybeSingle();
        }

        if (!res.data && cleanCode.length >= 4) {
          res = await admin
            .from("sessions")
            .select("*, courses(*)")
            .or(`meeting_code.ilike.%${cleanCode}%,id.ilike.${cleanCode}%`)
            .limit(1)
            .maybeSingle();
        }

        if (res.data) {
          session = res.data;
          error = null;
        }
      } catch (adminErr) {
        console.warn("Admin session lookup fallback error:", adminErr);
      }
    }

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
