import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionParticipantRecord, AdmissionStatus } from "@/lib/supabase/types";

// Helper to atomically bump state_version on the session in PostgreSQL
async function bumpStateVersion(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<number> {
  try {
    const { data: currentSession } = await admin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    const nextVersion = (Number(currentSession?.state_version) || 0) + 1;

    await admin
      .from("sessions")
      .update({ state_version: nextVersion, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return nextVersion;
  } catch (err) {
    console.warn("[bumpStateVersion] warning:", err);
    return Date.now();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const isMeOnly = searchParams.get("me") === "true";

    const { data: session } = await admin
      .from("sessions")
      .select("created_by")
      .eq("id", sessionId)
      .single();

    const isLecturer = session?.created_by === user.id;

    if (isMeOnly) {
      if (isLecturer) {
        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "lecturer",
          userId: user.id,
        });
      }

      const { data: myRecord } = await admin
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      return NextResponse.json({
        status: (myRecord?.status || "waiting") as AdmissionStatus,
        role: "student",
        userId: user.id,
        admittedAt: myRecord?.admitted_at,
      });
    }

    // Fetch full roster with RLS rules
    const { data: partData, error: partError } = await admin
      .from("session_participants")
      .select("*")
      .eq("session_id", sessionId);

    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }

    const participants = (partData || []) as SessionParticipantRecord[];
    const myRecord = participants.find((p) => p.user_id === user.id);
    const myStatus = isLecturer ? "admitted" : (myRecord?.status || "waiting");

    let visible = participants;
    if (!isLecturer) {
      if (myStatus === "admitted") {
        visible = participants.filter((p) => p.status === "admitted" || p.user_id === user.id);
      } else if (myRecord) {
        visible = [myRecord];
      } else {
        visible = [];
      }
    }

    return NextResponse.json({
      participants: visible.map((p) => ({
        userId: p.user_id,
        name: p.user_name,
        role: p.role,
        status: p.status,
        joinedAt: p.joined_at,
        admittedAt: p.admitted_at,
      })),
      myStatus,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
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

    // 2. Fetch session and verify ownership
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isLecturer = session.created_by === user.id;
    const body = await request.json().catch(() => ({}));
    const { action, targetUserId, userName } = body as {
      action: "join" | "re_request" | "admit" | "deny" | "kick" | "leave";
      targetUserId?: string;
      userName?: string;
    };

    const resolvedUserName =
      userName ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Student";

    // ── ACTION: JOIN (Knock / Check Admission) ────────────────────────────────
    if (action === "join") {
      if (isLecturer) {
        // Upsert lecturer as admitted
        await admin.from("session_participants").upsert(
          {
            session_id: sessionId,
            user_id: user.id,
            user_name: resolvedUserName,
            role: "lecturer",
            status: "admitted",
            joined_at: new Date().toISOString(),
            admitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id,user_id" }
        );

        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "lecturer",
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // Check existing student record
      const { data: existing } = await admin
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        if (existing.status === "admitted") {
          return NextResponse.json({
            status: "admitted" as AdmissionStatus,
            role: "student",
            stateVersion: Number(session.state_version) || 0,
          });
        }
        if (existing.status === "denied") {
          return NextResponse.json(
            {
              error: "Admission was denied by the lecturer. You may request to re-join after the cooldown.",
              status: "denied" as AdmissionStatus,
              updatedAt: existing.updated_at,
            },
            { status: 403 }
          );
        }
        if (existing.status === "left") {
          // Re-entering waiting lobby
          await admin
            .from("session_participants")
            .update({
              status: "waiting",
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("session_id", sessionId)
            .eq("user_id", user.id);

          const newVersion = await bumpStateVersion(admin, sessionId);
          return NextResponse.json({
            status: "waiting" as AdmissionStatus,
            role: "student",
            stateVersion: newVersion,
          });
        }

        // Already waiting
        return NextResponse.json({
          status: "waiting" as AdmissionStatus,
          role: "student",
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // New student registration -> insert waiting
      await admin.from("session_participants").insert({
        session_id: sessionId,
        user_id: user.id,
        user_name: resolvedUserName,
        role: "student",
        status: "waiting",
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const newVersion = await bumpStateVersion(admin, sessionId);
      return NextResponse.json({
        status: "waiting" as AdmissionStatus,
        role: "student",
        stateVersion: newVersion,
      });
    }

    // ── ACTION: RE_REQUEST (Denied student requesting re-entry with 30s cooldown)
    if (action === "re_request") {
      const { data: existing } = await admin
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (!existing) {
        return NextResponse.json({ error: "Participant record not found" }, { status: 404 });
      }

      const COOLDOWN_MS = 30 * 1000;
      const lastUpdated = new Date(existing.updated_at).getTime();
      const elapsed = Date.now() - lastUpdated;

      if (elapsed < COOLDOWN_MS) {
        const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: `Please wait ${remainingSec}s before re-requesting admission.` },
          { status: 429 }
        );
      }

      await admin
        .from("session_participants")
        .update({
          status: "waiting",
          user_name: resolvedUserName,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      const newVersion = await bumpStateVersion(admin, sessionId);
      return NextResponse.json({
        status: "waiting" as AdmissionStatus,
        stateVersion: newVersion,
      });
    }

    // ── RBAC CHECK FOR LECTURER-ONLY ACTIONS ─────────────────────────────────
    if (action === "admit" || action === "deny" || action === "kick") {
      if (!isLecturer) {
        return NextResponse.json(
          { error: "Forbidden: Only the session lecturer can modify admission states." },
          { status: 403 }
        );
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
      }

      // ── ACTION: ADMIT ──────────────────────────────────────────────────────
      if (action === "admit") {
        if (targetUserId === "ALL") {
          await admin
            .from("session_participants")
            .update({
              status: "admitted",
              admitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("session_id", sessionId)
            .eq("status", "waiting");
        } else {
          await admin
            .from("session_participants")
            .upsert(
              {
                session_id: sessionId,
                user_id: targetUserId,
                user_name: userName || "Student",
                role: "student",
                status: "admitted",
                admitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "session_id,user_id" }
            );
        }

        const newVersion = await bumpStateVersion(admin, sessionId);
        return NextResponse.json({
          success: true,
          action: "admit",
          targetUserId,
          stateVersion: newVersion,
        });
      }

      // ── ACTION: DENY / KICK ────────────────────────────────────────────────
      if (action === "deny" || action === "kick") {
        await admin
          .from("session_participants")
          .update({
            status: "denied",
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("user_id", targetUserId);

        const newVersion = await bumpStateVersion(admin, sessionId);
        return NextResponse.json({
          success: true,
          action,
          targetUserId,
          stateVersion: newVersion,
        });
      }
    }

    // ── ACTION: LEAVE ────────────────────────────────────────────────────────
    if (action === "leave") {
      await admin
        .from("session_participants")
        .update({
          status: "left",
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json({ success: true, action: "leave" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/participants error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
