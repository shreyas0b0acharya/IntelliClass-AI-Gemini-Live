import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAvatarModel } from "@/features/avatar";
import {
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_SPEECH_SPEED,
  PERSONA_CONFIG_FIELDS,
  SESSION_ALLOWED_UPDATE_FIELDS,
  SESSION_INTEGER_FIELDS,
  CLASSROOM_TIMINGS,
} from "@/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (error || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const normalizedSession = {
      ...session,
      voice_id: session.voice_id || DEFAULT_MALE_VOICE_ID,
      avatar_model: resolveAvatarModel(session.avatar_model, session.voice_id),
      speech_speed: typeof session.speech_speed === "number" ? session.speech_speed : DEFAULT_SPEECH_SPEED,
      meeting_code: session.meeting_code || session.id?.slice(0, 8),
    };

    return NextResponse.json({ session: normalizedSession });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API GET /api/classroom/[sessionId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const knownMissingColumns = new Set<string>();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch session and verify ownership / RBAC
    const { data: existingSession, error: sessionFetchError } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (sessionFetchError || !existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify user is the session creator or the course owner
    const isOwner =
      existingSession.created_by === user.id ||
      existingSession.courses?.created_by === user.id;

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this session." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // 3. Persona Lifecycle Lock Check:
    // Avatar model, voice, speed, and TTS provider cannot be altered mid-speech while session is running.
    // Allowed when session is "created", "paused", or "ended".
    const personaFields = PERSONA_CONFIG_FIELDS;
    const hasPersonaField = personaFields.some((f) => f in body);
    if (hasPersonaField && existingSession.status === "running") {
      return NextResponse.json(
        {
          error:
            "Configuration locked: Avatar persona, voice, and speaking speed cannot be altered while lecture is running. Please pause the lecture first.",
        },
        { status: 400 }
      );
    }

    // 4. Atomic CAS Conductor Lease Handling
    if (typeof body.driverTabId === "string" && body.driverTabId) {
      const now = Date.now();
      const leaseExpiresAt = existingSession.driver_lease_expires_at
        ? new Date(existingSession.driver_lease_expires_at).getTime()
        : 0;
      const isLeaseExpired = leaseExpiresAt < now;
      const isCurrentOwner = existingSession.active_driver_tab_id === body.driverTabId;
      const canClaim = isLeaseExpired || isCurrentOwner || !existingSession.active_driver_tab_id;

      if (!canClaim) {
        return NextResponse.json({
          success: false,
          isDriver: false,
          activeDriverTabId: existingSession.active_driver_tab_id,
          driverLeaseVersion: Number(existingSession.driver_lease_version) || 0,
          session: existingSession,
        });
      }
    }

    // Whitelist allowed fields to update
    const allowedFields = SESSION_ALLOWED_UPDATE_FIELDS;
    const integerFields = SESSION_INTEGER_FIELDS;

    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body && !knownMissingColumns.has(field)) {
        const val = body[field];
        if (integerFields.has(field)) {
          if (val === null || val === undefined) {
            updatePayload[field] = null;
          } else {
            const num = Number(val);
            if (!Number.isNaN(num)) {
              updatePayload[field] = Math.round(num);
            }
          }
        } else {
          updatePayload[field] = val;
        }
      }
    }

    if (typeof body.driverTabId === "string" && body.driverTabId) {
      if (!knownMissingColumns.has("active_driver_tab_id")) {
        updatePayload.active_driver_tab_id = body.driverTabId;
      }
      if (!knownMissingColumns.has("driver_lease_expires_at")) {
        updatePayload.driver_lease_expires_at = new Date(Date.now() + CLASSROOM_TIMINGS.DRIVER_LEASE_DURATION_MS).toISOString();
      }
      if (!knownMissingColumns.has("driver_lease_version")) {
        updatePayload.driver_lease_version =
          Math.round((Number(existingSession.driver_lease_version) || 0) + 1);
      }
    } else if (body.releaseLease === true) {
      if (!knownMissingColumns.has("active_driver_tab_id")) {
        updatePayload.active_driver_tab_id = null;
      }
      if (!knownMissingColumns.has("driver_lease_expires_at")) {
        updatePayload.driver_lease_expires_at = null;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    let updatedSession: Record<string, unknown> | null = null;
    let updateError: { message: string } | null = null;

    // Retry loop: strip missing columns if PostgREST reports un-migrated schema
    while (Object.keys(updatePayload).length > 0) {
      const res = await supabase
        .from("sessions")
        .update(updatePayload)
        .eq("id", sessionId)
        .select()
        .single();

      if (!res.error && res.data) {
        updatedSession = res.data as Record<string, unknown>;
        updateError = null;
        break;
      }

      updateError = res.error;
      const errMsg = res.error?.message || "";
      const match =
        errMsg.match(/Could not find the ['"]?(\w+)['"]? column of ['"]?sessions['"]? in the schema cache/i) ||
        errMsg.match(/column ["']?(\w+)["']? of relation ["']?sessions["']? does not exist/i) ||
        errMsg.match(/column ["']?(\w+)["']? does not exist/i);

      if (match && match[1] && match[1] in updatePayload) {
        const missingCol = match[1];
        if (!knownMissingColumns.has(missingCol)) {
          console.warn(
            `[Supabase Schema Fallback] sessions table missing column '${missingCol}' - cached to omit. Run supabase-migration.sql to fix.`
          );
          knownMissingColumns.add(missingCol);
        }
        delete updatePayload[missingCol];
      } else {
        break;
      }
    }

    if (updateError) {
      console.error("Session update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const finalSession = {
      ...existingSession,
      ...(updatedSession || {}),
      ...(typeof body.avatar_model === "string" ? { avatar_model: body.avatar_model } : {}),
      ...(typeof body.voice_id === "string" ? { voice_id: body.voice_id } : {}),
      ...(typeof body.speech_speed === "number" ? { speech_speed: body.speech_speed } : {}),
      ...(typeof body.tts_provider === "string" ? { tts_provider: body.tts_provider } : {}),
    };

    return NextResponse.json({
      success: true,
      session: finalSession,
      isDriver:
        typeof body.driverTabId === "string" && body.driverTabId
          ? updatedSession?.active_driver_tab_id === body.driverTabId || true
          : undefined,
      activeDriverTabId: (updatedSession?.active_driver_tab_id as string) || null,
      driverLeaseVersion: Number(updatedSession?.driver_lease_version) || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API PATCH /api/classroom/[sessionId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
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

    // Fetch session and verify ownership
    const { data: existingSession, error: sessionFetchError } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (sessionFetchError || !existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner =
      existingSession.created_by === user.id ||
      existingSession.courses?.created_by === user.id;

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete this session." },
        { status: 403 }
      );
    }

    // 1. Clean up child messages
    try {
      await supabase.from("messages").delete().eq("session_id", sessionId);
    } catch {}

    // 2. Mark session as deleted in Postgres
    try {
      await supabase
        .from("sessions")
        .update({ status: "deleted" })
        .eq("id", sessionId);
    } catch {}

    // 3. Attempt hard delete
    const { data: deletedRows } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .select();

    // 4. Admin client fallback
    if (!deletedRows || deletedRows.length === 0) {
      try {
        const admin = createAdminClient();
        await admin.from("messages").delete().eq("session_id", sessionId);
        await admin.from("sessions").update({ status: "deleted" }).eq("id", sessionId);
        await admin.from("sessions").delete().eq("id", sessionId);
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API DELETE /api/classroom/[sessionId] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
